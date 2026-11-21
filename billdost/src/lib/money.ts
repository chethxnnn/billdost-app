// BillDost money engine. The ONLY place invoice and quotation totals are
// computed, on client (live preview) and server (stored truth) alike.
//
// Rules (blueprint C2):
// - All internal math is integer paise. Rupees convert at the boundary.
// - Tax is charged on the DISCOUNTED line value, never the pre-discount base.
// - Bill-level discount is allocated pro-rata across lines with the
//   largest-remainder method, so line discounts sum exactly to the bill
//   discount with no paisa drift.
// - Place of supply: if the customer state code differs from the shop state
//   code the sale is inter-state and all tax is IGST. Otherwise tax splits
//   CGST / SGST, with the odd paisa going to CGST.
// - Round-off, when enabled, is an explicit stored amount that takes the
//   grand total to the nearest rupee.
// - An unregistered shop charges no tax at all (bill of supply).

/** GST rates (percent) the server accepts. Anything else is a typo. */
export const ALLOWED_TAX_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 12, 18, 28] as const

export interface MoneyItemInput {
  name?: string
  hsn_code?: string | null
  quantity: number
  /** Per unit, tax-exclusive, in rupees. */
  unit_price: number
  /** Per LINE (not per unit), in rupees. Taxed at the line rate. */
  making_charge?: number | null
  /** Percent, e.g. 18. */
  tax_rate: number
  /** Optional per-item discount percent, applied before the bill discount. */
  discount_pct?: number | null
}

export interface MoneyInput {
  items: MoneyItemInput[]
  /** Bill-level discount percent, applied pro-rata across lines. */
  discount_pct: number
  /** GST state code of the shop, e.g. "29" for Karnataka. */
  shop_state_code?: string | null
  /** GST state code of the customer, if known. */
  customer_state_code?: string | null
  /** Customer GSTIN, if any. Its first two digits are a state code. */
  customer_gstin?: string | null
  is_gst_registered: boolean
  /** Whether to round the grand total to the nearest rupee. */
  round_off: boolean
}

export interface MoneyLine {
  name: string
  hsn_code: string | null
  tax_rate: number
  /** quantity * unit_price + making_charge, in rupees. */
  base: number
  discount_amt: number
  taxable_amt: number
  tax_amt: number
  cgst_amt: number
  sgst_amt: number
  igst_amt: number
  /** taxable_amt + tax_amt. Bill round-off is NOT allocated to lines. */
  total: number
}

export interface MoneyResult {
  lines: MoneyLine[]
  subtotal: number
  discount_amt: number
  taxable_amt: number
  cgst_amt: number
  sgst_amt: number
  igst_amt: number
  /** Total tax: cgst_amt + sgst_amt + igst_amt. */
  tax_amt: number
  round_off_amt: number
  total: number
  is_interstate: boolean
  place_of_supply_state_code: string | null
}

export interface HsnSummaryRow {
  hsn_code: string
  tax_rate: number
  taxable_amt: number
  cgst_amt: number
  sgst_amt: number
  igst_amt: number
  tax_amt: number
}

/** Rupees to integer paise, rounding half up. */
export function toPaise(rupees: number): number {
  return Math.round((rupees + Number.EPSILON) * 100)
}

/** Integer paise to rupees (a number with at most 2 decimal places). */
export function fromPaise(paise: number): number {
  return paise / 100
}

/** Round a paise-denominated float half up to the nearest integer paisa. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5)
}

/** Extract the GST state code (first two digits) from a GSTIN, if present. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null
  const match = gstin.trim().toUpperCase().match(/^(\d{2})/)
  return match ? match[1] : null
}

/** Standard GSTIN format check (state code, PAN, entity, Z, check char). */
export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/

export function isValidGstin(gstin: string | null | undefined): boolean {
  if (!gstin) return false
  return GSTIN_REGEX.test(gstin.trim().toUpperCase())
}

/**
 * Resolve the customer state code for place of supply: an explicit code
 * wins, then the GSTIN prefix. Null means unknown (treated as intra-state
 * for a B2C walk-in, per blueprint C2 step 5).
 */
export function resolveCustomerStateCode(input: {
  customer_state_code?: string | null
  customer_gstin?: string | null
}): string | null {
  if (input.customer_state_code && /^\d{2}$/.test(input.customer_state_code)) {
    return input.customer_state_code
  }
  return stateCodeFromGstin(input.customer_gstin)
}

export function computeTotals(input: MoneyInput): MoneyResult {
  const shopState = input.shop_state_code || null
  const customerState = resolveCustomerStateCode(input)
  const isInterstate = Boolean(
    input.is_gst_registered && shopState && customerState && customerState !== shopState,
  )
  const placeOfSupply = customerState || shopState

  const billDiscountPct = clampPct(input.discount_pct || 0)

  // Pass 1: line bases in paise.
  const bases = input.items.map((item) => {
    const unitPricePaise = toPaise(item.unit_price || 0)
    const makingPaise = toPaise(item.making_charge || 0)
    return roundHalfUp((item.quantity || 0) * unitPricePaise) + makingPaise
  })

  // Pass 2: per-item discounts, applied first on each line.
  const itemDiscounts = input.items.map((item, i) => {
    const pct = clampPct(item.discount_pct || 0)
    return roundHalfUp((bases[i] * pct) / 100)
  })
  const afterItemDiscount = bases.map((base, i) => base - itemDiscounts[i])

  // Pass 3: bill discount, allocated pro-rata by post-item-discount base
  // using largest remainder so the shares sum exactly to the target.
  const totalAfterItem = afterItemDiscount.reduce((a, b) => a + b, 0)
  const billDiscountTotal =
    totalAfterItem > 0 ? roundHalfUp((totalAfterItem * billDiscountPct) / 100) : 0
  const billShares = allocateProRata(billDiscountTotal, afterItemDiscount)

  // Pass 4: taxable, tax, splits, all in paise.
  let subtotalP = 0
  let discountP = 0
  let taxableP = 0
  let cgstP = 0
  let sgstP = 0
  let igstP = 0

  const lines: MoneyLine[] = input.items.map((item, i) => {
    const base = bases[i]
    const discount = itemDiscounts[i] + billShares[i]
    const taxable = base - discount
    let tax = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    if (input.is_gst_registered && taxable > 0) {
      tax = roundHalfUp((taxable * (item.tax_rate || 0)) / 100)
      if (isInterstate) {
        igst = tax
      } else {
        cgst = Math.ceil(tax / 2) // odd paisa goes to CGST
        sgst = tax - cgst
      }
    }
    subtotalP += base
    discountP += discount
    taxableP += taxable
    cgstP += cgst
    sgstP += sgst
    igstP += igst
    return {
      name: item.name || '',
      hsn_code: item.hsn_code ?? null,
      tax_rate: item.tax_rate || 0,
      base: fromPaise(base),
      discount_amt: fromPaise(discount),
      taxable_amt: fromPaise(taxable),
      tax_amt: fromPaise(tax),
      cgst_amt: fromPaise(cgst),
      sgst_amt: fromPaise(sgst),
      igst_amt: fromPaise(igst),
      total: fromPaise(taxable + tax),
    }
  })

  const taxP = cgstP + sgstP + igstP
  const preRoundP = taxableP + taxP
  let roundOffP = 0
  if (input.round_off) {
    const rounded = roundHalfUp(preRoundP / 100) * 100
    roundOffP = rounded - preRoundP
  }

  return {
    lines,
    subtotal: fromPaise(subtotalP),
    discount_amt: fromPaise(discountP),
    taxable_amt: fromPaise(taxableP),
    cgst_amt: fromPaise(cgstP),
    sgst_amt: fromPaise(sgstP),
    igst_amt: fromPaise(igstP),
    tax_amt: fromPaise(taxP),
    round_off_amt: fromPaise(roundOffP),
    total: fromPaise(preRoundP + roundOffP),
    is_interstate: isInterstate,
    place_of_supply_state_code: placeOfSupply,
  }
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0
  return Math.min(100, Math.max(0, pct))
}

/**
 * Split `total` paise across buckets weighted by `weights`, using largest
 * remainder so the parts sum exactly to `total`.
 */
function allocateProRata(total: number, weights: number[]): number[] {
  const shares = weights.map(() => 0)
  if (total <= 0) return shares
  const weightSum = weights.reduce((a, b) => a + b, 0)
  if (weightSum <= 0) return shares
  const exact = weights.map((w) => (total * w) / weightSum)
  const floors = exact.map((v) => Math.floor(v))
  let remainder = total - floors.reduce((a, b) => a + b, 0)
  const byFraction = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; k < byFraction.length && remainder > 0; k++) {
    floors[byFraction[k].i] += 1
    remainder -= 1
  }
  return floors
}

/**
 * HSN-wise summary for GST reports. Groups the computed lines by
 * (hsn_code, tax_rate). Items without an HSN group under an empty string.
 */
export function computeHsnSummary(
  result: MoneyResult,
  items?: MoneyItemInput[],
): HsnSummaryRow[] {
  const rows = new Map<string, HsnSummaryRow>()
  result.lines.forEach((line, i) => {
    const hsn = (items?.[i]?.hsn_code ?? line.hsn_code ?? '') || ''
    const key = `${hsn}|${line.tax_rate}`
    const existing =
      rows.get(key) ||
      ({
        hsn_code: hsn,
        tax_rate: line.tax_rate,
        taxable_amt: 0,
        cgst_amt: 0,
        sgst_amt: 0,
        igst_amt: 0,
        tax_amt: 0,
      } as HsnSummaryRow)
    existing.taxable_amt = fromPaise(toPaise(existing.taxable_amt) + toPaise(line.taxable_amt))
    existing.cgst_amt = fromPaise(toPaise(existing.cgst_amt) + toPaise(line.cgst_amt))
    existing.sgst_amt = fromPaise(toPaise(existing.sgst_amt) + toPaise(line.sgst_amt))
    existing.igst_amt = fromPaise(toPaise(existing.igst_amt) + toPaise(line.igst_amt))
    existing.tax_amt = fromPaise(toPaise(existing.tax_amt) + toPaise(line.tax_amt))
    rows.set(key, existing)
  })
  return Array.from(rows.values()).sort((a, b) =>
    a.hsn_code === b.hsn_code ? a.tax_rate - b.tax_rate : a.hsn_code < b.hsn_code ? -1 : 1,
  )
}

/** Derive payment status from a cash-received fact and a computed total. */
export function derivePaymentStatus(
  amountPaid: number,
  total: number,
): 'unpaid' | 'partial' | 'paid' {
  const paidP = toPaise(amountPaid || 0)
  const totalP = toPaise(total || 0)
  if (paidP <= 0) return 'unpaid'
  if (paidP >= totalP) return 'paid'
  return 'partial'
}
