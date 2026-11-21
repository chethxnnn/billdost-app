import { describe, it, expect } from 'vitest'
import {
  computeTotals,
  computeHsnSummary,
  derivePaymentStatus,
  stateCodeFromGstin,
  isValidGstin,
  toPaise,
} from '../money'

const KA = '29' // Karnataka (shop)
const MH = '27' // Maharashtra (customer, inter-state vs KA)
const GSTIN_MH = '27ABCDE1234F1Z5'
const GSTIN_KA = '29ABCDE1234F1Z5'

function base(overrides: Partial<Parameters<typeof computeTotals>[0]> = {}) {
  return {
    items: [{ name: 'Item', quantity: 1, unit_price: 1000, tax_rate: 18 }],
    discount_pct: 0,
    shop_state_code: KA,
    customer_state_code: KA,
    customer_gstin: null,
    is_gst_registered: true,
    round_off: false,
    ...overrides,
  }
}

describe('computeTotals: the 10 named blueprint C2 tests', () => {
  it('1. no discount, intra-state, single item 18 percent: exact split', () => {
    const r = computeTotals(base())
    expect(r.subtotal).toBe(1000)
    expect(r.taxable_amt).toBe(1000)
    expect(r.cgst_amt).toBe(90)
    expect(r.sgst_amt).toBe(90)
    expect(r.igst_amt).toBe(0)
    expect(r.total).toBe(1180)
    expect(r.is_interstate).toBe(false)
  })

  it('2. 10 percent bill discount: tax is on the discounted value, not pre-discount', () => {
    const r = computeTotals(base({ discount_pct: 10 }))
    expect(r.discount_amt).toBe(100)
    expect(r.taxable_amt).toBe(900)
    // Tax on 900 at 18% = 162. The original bug produced 180.
    expect(r.tax_amt).toBe(162)
    expect(r.tax_amt).not.toBe(180)
    expect(r.cgst_amt).toBe(81)
    expect(r.sgst_amt).toBe(81)
    expect(r.total).toBe(1062)
  })

  it('3. inter-state with GSTIN: full tax to IGST, CGST and SGST are 0', () => {
    const r = computeTotals(
      base({ customer_state_code: MH, customer_gstin: GSTIN_MH }),
    )
    expect(r.is_interstate).toBe(true)
    expect(r.igst_amt).toBe(180)
    expect(r.cgst_amt).toBe(0)
    expect(r.sgst_amt).toBe(0)
    expect(r.place_of_supply_state_code).toBe(MH)
    expect(r.total).toBe(1180)
  })

  it('4. inter-state B2C (state given, no GSTIN): still IGST', () => {
    const r = computeTotals(base({ customer_state_code: MH, customer_gstin: null }))
    expect(r.is_interstate).toBe(true)
    expect(r.igst_amt).toBe(180)
  })

  it('5. mixed rates with discount: line sums equal header sums to the paisa', () => {
    const items = [0, 5, 12, 18, 28].map((rate, i) => ({
      name: `Rate ${rate}`,
      hsn_code: `100${i}`,
      quantity: i + 1,
      unit_price: 333.33,
      tax_rate: rate,
    }))
    const r = computeTotals(base({ items, discount_pct: 7 }))
    const sum = (pick: (l: (typeof r.lines)[number]) => number) =>
      Math.round(r.lines.reduce((a, l) => a + pick(l), 0) * 100) / 100
    expect(sum((l) => l.taxable_amt)).toBe(r.taxable_amt)
    expect(sum((l) => l.discount_amt)).toBe(r.discount_amt)
    expect(sum((l) => l.tax_amt)).toBe(r.tax_amt)
    expect(r.cgst_amt + r.sgst_amt + r.igst_amt).toBe(r.tax_amt)
    const hsn = computeHsnSummary(r, items)
    const hsnTaxable = Math.round(hsn.reduce((a, h) => a + h.taxable_amt, 0) * 100) / 100
    const hsnTax = Math.round(hsn.reduce((a, h) => a + h.tax_amt, 0) * 100) / 100
    expect(hsnTaxable).toBe(r.taxable_amt)
    expect(hsnTax).toBe(r.tax_amt)
  })

  it('6. odd paisa split: 0.01 tax splits 0.01 CGST and 0.00 SGST', () => {
    const r = computeTotals(
      base({ items: [{ name: 'Tiny', quantity: 1, unit_price: 0.06, tax_rate: 18 }] }),
    )
    // taxable 0.06, tax = round(0.06 * 0.18) = 0.01
    expect(r.tax_amt).toBe(0.01)
    expect(r.cgst_amt).toBe(0.01)
    expect(r.sgst_amt).toBe(0)
    expect(r.cgst_amt + r.sgst_amt).toBe(r.tax_amt)
  })

  it('7. round-off on: whole rupee total, round_off within 0.50; off: exact', () => {
    const items = [{ name: 'Odd', quantity: 3, unit_price: 111.11, tax_rate: 5 }]
    const on = computeTotals(base({ items, round_off: true }))
    expect(on.total % 1).toBe(0)
    expect(Math.abs(on.round_off_amt)).toBeLessThanOrEqual(0.5)
    expect(on.taxable_amt + on.tax_amt + on.round_off_amt).toBeCloseTo(on.total, 2)
    const off = computeTotals(base({ items, round_off: false }))
    expect(off.round_off_amt).toBe(0)
    expect(off.total).toBe(off.taxable_amt + off.tax_amt)
  })

  it('8. unregistered shop: all tax outputs are 0', () => {
    const r = computeTotals(base({ is_gst_registered: false, customer_state_code: MH }))
    expect(r.tax_amt).toBe(0)
    expect(r.cgst_amt).toBe(0)
    expect(r.sgst_amt).toBe(0)
    expect(r.igst_amt).toBe(0)
    expect(r.is_interstate).toBe(false)
    expect(r.total).toBe(1000)
  })

  it('9. making charge is in the line base and taxed at the line rate', () => {
    const r = computeTotals(
      base({
        items: [
          { name: 'Gold ring', quantity: 1, unit_price: 10000, making_charge: 500, tax_rate: 3 },
        ],
      }),
    )
    expect(r.subtotal).toBe(10500)
    expect(r.taxable_amt).toBe(10500)
    expect(r.tax_amt).toBe(315)
    expect(r.total).toBe(10815)
  })

  it('10. property: random baskets reconcile exactly', () => {
    let seed = 42
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(rand() * 6)
      const items = Array.from({ length: n }, (_, i) => ({
        name: `Item ${i}`,
        quantity: Math.round(rand() * 1000) / 100 + 0.01,
        unit_price: Math.round(rand() * 100000) / 100,
        making_charge: Math.round(rand() * 10000) / 100,
        tax_rate: [0, 5, 12, 18, 28][Math.floor(rand() * 5)],
      }))
      const r = computeTotals(
        base({
          items,
          discount_pct: Math.round(rand() * 3000) / 100,
          customer_state_code: rand() > 0.5 ? MH : KA,
          round_off: rand() > 0.5,
        }),
      )
      const lineTotalSum = r.lines.reduce((a, l) => a + toPaise(l.total), 0)
      expect(lineTotalSum + toPaise(r.round_off_amt)).toBe(toPaise(r.total))
      expect(toPaise(r.cgst_amt) + toPaise(r.sgst_amt) + toPaise(r.igst_amt)).toBe(
        toPaise(r.tax_amt),
      )
      const lineTaxSum = r.lines.reduce((a, l) => a + toPaise(l.tax_amt), 0)
      expect(lineTaxSum).toBe(toPaise(r.tax_amt))
    }
  })
})

describe('computeTotals: edge cases', () => {
  it('100 percent discount zeroes taxable, tax and total', () => {
    const r = computeTotals(base({ discount_pct: 100 }))
    expect(r.discount_amt).toBe(1000)
    expect(r.taxable_amt).toBe(0)
    expect(r.tax_amt).toBe(0)
    expect(r.total).toBe(0)
  })

  it('100 percent discount with round-off still totals 0', () => {
    const r = computeTotals(base({ discount_pct: 100, round_off: true }))
    expect(r.total).toBe(0)
    expect(r.round_off_amt).toBe(0)
  })

  it('per-item discount applies before the bill discount', () => {
    const r = computeTotals(
      base({
        items: [{ name: 'A', quantity: 1, unit_price: 1000, tax_rate: 18, discount_pct: 10 }],
        discount_pct: 10,
      }),
    )
    // 1000 - 100 (item) = 900; bill discount 10% of 900 = 90; taxable 810.
    expect(r.discount_amt).toBe(190)
    expect(r.taxable_amt).toBe(810)
    expect(r.tax_amt).toBe(145.8)
  })

  it('pro-rata allocation has no paisa drift on awkward amounts', () => {
    const items = [1, 1, 1].map((_, i) => ({
      name: `I${i}`,
      quantity: 1,
      unit_price: 33.33,
      tax_rate: 0,
    }))
    const r = computeTotals(base({ items, discount_pct: 10 }))
    const discountSum = r.lines.reduce((a, l) => a + toPaise(l.discount_amt), 0)
    expect(discountSum).toBe(toPaise(r.discount_amt))
    expect(r.discount_amt).toBe(10) // 10 percent of 99.99 is 9.999, rounds to 10.00
  })

  it('fractional quantities (kg) compute correctly', () => {
    const r = computeTotals(
      base({ items: [{ name: 'Rice', quantity: 2.5, unit_price: 60, tax_rate: 5 }] }),
    )
    expect(r.subtotal).toBe(150)
    expect(r.tax_amt).toBe(7.5)
    expect(r.total).toBe(157.5)
  })

  it('customer state derived from GSTIN when no explicit state code', () => {
    const r = computeTotals(base({ customer_state_code: null, customer_gstin: GSTIN_MH }))
    expect(r.is_interstate).toBe(true)
    expect(r.igst_amt).toBe(180)
  })

  it('unknown customer state for a walk-in stays intra-state', () => {
    const r = computeTotals(base({ customer_state_code: null, customer_gstin: null }))
    expect(r.is_interstate).toBe(false)
    expect(r.cgst_amt).toBe(90)
    expect(r.place_of_supply_state_code).toBe(KA)
  })

  it('zero-rate and exempt items carry no tax but keep totals', () => {
    const r = computeTotals(
      base({ items: [{ name: 'Exempt', quantity: 2, unit_price: 250, tax_rate: 0 }] }),
    )
    expect(r.tax_amt).toBe(0)
    expect(r.total).toBe(500)
  })

  it('empty discount and empty items are safe', () => {
    const r = computeTotals(base({ items: [] }))
    expect(r.total).toBe(0)
    expect(r.lines).toHaveLength(0)
  })

  it('HSN summary groups by hsn and rate', () => {
    const items = [
      { name: 'A', hsn_code: '1001', quantity: 1, unit_price: 100, tax_rate: 5 },
      { name: 'B', hsn_code: '1001', quantity: 1, unit_price: 200, tax_rate: 5 },
      { name: 'C', hsn_code: '1001', quantity: 1, unit_price: 200, tax_rate: 18 },
      { name: 'D', hsn_code: '2002', quantity: 1, unit_price: 50, tax_rate: 5 },
    ]
    const r = computeTotals(base({ items }))
    const hsn = computeHsnSummary(r, items)
    expect(hsn).toHaveLength(3)
    const first = hsn.find((h) => h.hsn_code === '1001' && h.tax_rate === 5)!
    expect(first.taxable_amt).toBe(300)
    expect(first.tax_amt).toBe(15)
  })
})

describe('helpers', () => {
  it('stateCodeFromGstin reads the two digit prefix', () => {
    expect(stateCodeFromGstin(GSTIN_KA)).toBe('29')
    expect(stateCodeFromGstin(null)).toBeNull()
    expect(stateCodeFromGstin('not-a-gstin')).toBeNull()
  })

  it('isValidGstin accepts a well formed GSTIN and rejects junk', () => {
    expect(isValidGstin(GSTIN_MH)).toBe(true)
    expect(isValidGstin('27ABCDE1234F1Z')).toBe(false)
    expect(isValidGstin('')).toBe(false)
  })

  it('derivePaymentStatus follows amount paid vs total', () => {
    expect(derivePaymentStatus(0, 100)).toBe('unpaid')
    expect(derivePaymentStatus(40, 100)).toBe('partial')
    expect(derivePaymentStatus(100, 100)).toBe('paid')
    expect(derivePaymentStatus(0, 0)).toBe('unpaid')
  })
})
