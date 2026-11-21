/**
 * GSTR-1 builder (blueprint D9).
 *
 * Pure functions over stored invoice data. Nothing is recomputed
 * differently here: line tax splits reuse the money engine's own
 * rule (intrastate CGST takes the odd paisa, SGST the remainder;
 * interstate is all IGST), applied to the tax amounts already stored
 * on invoice_items, so section totals tie back to the invoice
 * headers exactly.
 *
 * Section mapping (GSTN offline format):
 *  - B2B: buyer has a GSTIN.
 *  - B2CL: no GSTIN, interstate, invoice value above Rs 1,00,000.
 *  - B2CS: every other no-GSTIN sale, aggregated by supply type,
 *    place of supply and rate.
 *  - CDNR / CDNUR: credit notes against registered / unregistered
 *    buyers.
 *  - HSN summary and the docs series summary.
 * Cancelled bills are excluded and counted in meta with a warning.
 */

export interface Gstr1LineInput {
  hsn_code: string | null
  tax_rate: number
  taxable_amt: number
  tax_amt: number
  quantity: number
  unit: string
}

export interface Gstr1InvoiceInput {
  invoice_number: string
  invoice_date: string // YYYY-MM-DD
  customer_name: string
  customer_gstin: string | null
  place_of_supply_state_code: string | null
  is_interstate: boolean
  total: number
  status: string
  lines: Gstr1LineInput[]
}

export interface Gstr1CreditNoteInput {
  note_number: string
  note_date: string // YYYY-MM-DD
  reason: string | null
  original_invoice_number: string
  customer_gstin: string | null
  place_of_supply_state_code: string | null
  is_interstate: boolean
  taxable_amt: number
  tax_amt: number
  total: number
  /** Weighted rate of the original invoice, when determinable. */
  tax_rate: number | null
}

export interface Gstr1BuildInput {
  shop_gstin: string | null
  shop_state_code: string | null
  /** Filing period as MMYYYY, e.g. 112026. */
  fp: string
  invoices: Gstr1InvoiceInput[]
  credit_notes: Gstr1CreditNoteInput[]
}

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/** YYYY-MM-DD to the GSTN DD-MM-YYYY format. */
export function gstrDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/** Split one line's stored tax into CGST/SGST/IGST, money-engine rule. */
export function splitLineTax(
  taxAmt: number,
  isInterstate: boolean
): { camt: number; samt: number; iamt: number } {
  const taxPaise = Math.round(taxAmt * 100)
  if (isInterstate) return { camt: 0, samt: 0, iamt: round2(taxPaise / 100) }
  const cgstPaise = Math.ceil(taxPaise / 2)
  return {
    camt: round2(cgstPaise / 100),
    samt: round2((taxPaise - cgstPaise) / 100),
    iamt: 0,
  }
}

const UQC_MAP: Record<string, string> = {
  piece: 'NOS',
  kg: 'KGS',
  g: 'GMS',
  litre: 'LTR',
  ml: 'MLT',
  dozen: 'DOZ',
  pack: 'PAC',
  service: 'OTH',
  hour: 'OTH',
}

export function mapUqc(unit: string): string {
  return UQC_MAP[unit] || 'OTH'
}

export const B2CL_THRESHOLD = 100000

interface ItemDetail {
  txval: number
  rt: number
  camt: number
  samt: number
  iamt: number
}

function invoiceItems(inv: Gstr1InvoiceInput): Array<{ num: number; itm_det: ItemDetail }> {
  return inv.lines.map((line, i) => {
    const split = splitLineTax(line.tax_amt, inv.is_interstate)
    return {
      num: i + 1,
      itm_det: {
        txval: round2(line.taxable_amt),
        rt: line.tax_rate,
        camt: split.camt,
        samt: split.samt,
        iamt: split.iamt,
      },
    }
  })
}

function invoiceEntry(inv: Gstr1InvoiceInput, pos: string) {
  return {
    inum: inv.invoice_number,
    idt: gstrDate(inv.invoice_date),
    val: round2(inv.total),
    pos,
    rchrg: 'N',
    inv_typ: 'R',
    itms: invoiceItems(inv),
  }
}

export function buildGstr1(input: Gstr1BuildInput) {
  const warnings: string[] = []
  const active = input.invoices.filter((i) => i.status !== 'cancelled')
  const cancelledCount = input.invoices.length - active.length
  if (cancelledCount > 0) {
    warnings.push(
      `${cancelledCount} cancelled bill(s) GSTR-1 me shamil nahi hain. Cancelled bills GST return me nahi jaate.`
    )
  }

  const posOf = (inv: Gstr1InvoiceInput): string => {
    const pos = inv.place_of_supply_state_code || input.shop_state_code
    if (!inv.place_of_supply_state_code) {
      warnings.push(
        `Bill ${inv.invoice_number}: place of supply nahi mila, shop ke state code (${input.shop_state_code || 'NA'}) se bhara gaya hai.`
      )
    }
    return pos || ''
  }

  // ---- B2B, grouped by buyer GSTIN
  const b2bMap = new Map<string, ReturnType<typeof invoiceEntry>[]>()
  // ---- B2CL, grouped by place of supply
  const b2clMap = new Map<string, ReturnType<typeof invoiceEntry>[]>()
  // ---- B2CS aggregation buckets
  const b2csMap = new Map<string, { sply_ty: string; pos: string; rt: number; txval: number; camt: number; samt: number; iamt: number }>()

  for (const inv of active) {
    const pos = posOf(inv)
    if (inv.customer_gstin) {
      const list = b2bMap.get(inv.customer_gstin) || []
      list.push(invoiceEntry(inv, pos))
      b2bMap.set(inv.customer_gstin, list)
      continue
    }
    if (inv.is_interstate && inv.total > B2CL_THRESHOLD) {
      const list = b2clMap.get(pos) || []
      list.push(invoiceEntry(inv, pos))
      b2clMap.set(pos, list)
      continue
    }
    for (const line of inv.lines) {
      const key = `${inv.is_interstate ? 'INTER' : 'INTRA'}|${pos}|${line.tax_rate}`
      const split = splitLineTax(line.tax_amt, inv.is_interstate)
      const bucket = b2csMap.get(key) || {
        sply_ty: inv.is_interstate ? 'INTER' : 'INTRA',
        pos,
        rt: line.tax_rate,
        txval: 0,
        camt: 0,
        samt: 0,
        iamt: 0,
      }
      bucket.txval = round2(bucket.txval + line.taxable_amt)
      bucket.camt = round2(bucket.camt + split.camt)
      bucket.samt = round2(bucket.samt + split.samt)
      bucket.iamt = round2(bucket.iamt + split.iamt)
      b2csMap.set(key, bucket)
    }
  }

  // ---- Credit notes
  const cdnrMap = new Map<string, any[]>()
  const cdnur: any[] = []
  for (const note of input.credit_notes) {
    const pos = note.place_of_supply_state_code || input.shop_state_code || ''
    const split = splitLineTax(note.tax_amt, note.is_interstate)
    if (note.tax_rate === null) {
      warnings.push(
        `Credit note ${note.note_number}: original bill ka tax rate pakka nahi mila, rate 0 ke saath bheja gaya hai. CA se confirm karo.`
      )
    }
    const entry = {
      ntty: 'C',
      num: note.note_number,
      dt: gstrDate(note.note_date),
      val: round2(note.total),
      pos,
      rsn: note.reason || 'Sales Return',
      inv_num: note.original_invoice_number,
      itms: [
        {
          num: 1,
          itm_det: {
            txval: round2(note.taxable_amt),
            rt: note.tax_rate ?? 0,
            camt: split.camt,
            samt: split.samt,
            iamt: split.iamt,
          },
        },
      ],
    }
    if (note.customer_gstin) {
      const list = cdnrMap.get(note.customer_gstin) || []
      list.push(entry)
      cdnrMap.set(note.customer_gstin, list)
    } else {
      cdnur.push({ typ: note.is_interstate ? 'INTER' : 'INTRA', ...entry })
    }
  }

  // ---- HSN summary
  const hsnMap = new Map<string, any>()
  for (const inv of active) {
    for (const line of inv.lines) {
      const hsn = line.hsn_code || ''
      if (!hsn) {
        warnings.push(
          `Bill ${inv.invoice_number}: ek item par HSN code nahi hai. HSN summary adhura reh sakta hai.`
        )
      }
      const key = `${hsn}|${line.tax_rate}|${line.unit}`
      const split = splitLineTax(line.tax_amt, inv.is_interstate)
      const row = hsnMap.get(key) || {
        hsn_sc: hsn,
        uqc: mapUqc(line.unit),
        qty: 0,
        txval: 0,
        camt: 0,
        samt: 0,
        iamt: 0,
        rt: line.tax_rate,
      }
      row.qty = round2(row.qty + line.quantity)
      row.txval = round2(row.txval + line.taxable_amt)
      row.camt = round2(row.camt + split.camt)
      row.samt = round2(row.samt + split.samt)
      row.iamt = round2(row.iamt + split.iamt)
      hsnMap.set(key, row)
    }
  }
  const hsnData = [...hsnMap.values()].map((row, i) => ({ num: i + 1, ...row }))

  // ---- Docs series: numbers are text (INV-1001 style), so the
  // summary reports the count and the first/last by date order.
  const sorted = [...active].sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))
  const docs =
    sorted.length > 0
      ? {
          doc_num: {
            docs: [
              {
                doc_typ: 1,
                num: 1,
                from: sorted[0].invoice_number,
                to: sorted[sorted.length - 1].invoice_number,
                totnum: sorted.length,
                cancel: cancelledCount,
              },
            ],
          },
        }
      : undefined

  const dedupedWarnings = [...new Set(warnings)]

  return {
    gstin: input.shop_gstin,
    fp: input.fp,
    ...(b2bMap.size > 0
      ? { b2b: [...b2bMap.entries()].map(([ctin, inv]) => ({ ctin, inv })) }
      : {}),
    ...(b2clMap.size > 0
      ? { b2cl: [...b2clMap.entries()].map(([pos, inv]) => ({ pos, inv })) }
      : {}),
    ...(b2csMap.size > 0
      ? {
          b2cs: [...b2csMap.values()].map((b) => ({
            sply_ty: b.sply_ty,
            typ: 'OE',
            pos: b.pos,
            rt: b.rt,
            txval: b.txval,
            camt: b.camt,
            samt: b.samt,
            iamt: b.iamt,
          })),
        }
      : {}),
    ...(cdnrMap.size > 0
      ? { cdnr: [...cdnrMap.entries()].map(([ctin, nt]) => ({ ctin, nt })) }
      : {}),
    ...(cdnur.length > 0 ? { cdnur } : {}),
    ...(hsnData.length > 0 ? { hsn: { data: hsnData } } : {}),
    ...(docs ? { docs } : {}),
    meta: {
      invoice_count: active.length,
      cancelled_excluded: cancelledCount,
      credit_note_count: input.credit_notes.length,
      warnings: dedupedWarnings,
    },
  }
}
