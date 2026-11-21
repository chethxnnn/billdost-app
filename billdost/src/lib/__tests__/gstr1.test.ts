import { describe, expect, it } from 'vitest'
import { buildGstr1, gstrDate, mapUqc, splitLineTax } from '../gstr1'

describe('splitLineTax', () => {
  it('splits intrastate tax with the odd paisa going to CGST', () => {
    expect(splitLineTax(180, false)).toEqual({ camt: 90, samt: 90, iamt: 0 })
    expect(splitLineTax(1.01, false)).toEqual({ camt: 0.51, samt: 0.5, iamt: 0 })
  })

  it('puts all tax into IGST for interstate', () => {
    expect(splitLineTax(180, true)).toEqual({ camt: 0, samt: 0, iamt: 180 })
  })
})

describe('helpers', () => {
  it('formats dates for GSTN and maps units to UQC', () => {
    expect(gstrDate('2026-11-05')).toBe('05-11-2026')
    expect(mapUqc('piece')).toBe('NOS')
    expect(mapUqc('kg')).toBe('KGS')
    expect(mapUqc('unknown-unit')).toBe('OTH')
  })
})

const baseInvoice = {
  customer_name: 'Test Customer',
  customer_gstin: null as string | null,
  place_of_supply_state_code: '29',
  is_interstate: false,
  status: 'active',
}

describe('buildGstr1 section mapping', () => {
  const result = buildGstr1({
    shop_gstin: '29ABCDE1234F1Z5',
    shop_state_code: '29',
    fp: '112026',
    invoices: [
      {
        ...baseInvoice,
        invoice_number: 'INV-1',
        invoice_date: '2026-11-03',
        customer_gstin: '29PQRST6789K1Z2',
        total: 1180,
        lines: [{ hsn_code: '1001', tax_rate: 18, taxable_amt: 1000, tax_amt: 180, quantity: 2, unit: 'piece' }],
      },
      {
        ...baseInvoice,
        invoice_number: 'INV-2',
        invoice_date: '2026-11-04',
        place_of_supply_state_code: '27',
        is_interstate: true,
        total: 250000,
        lines: [{ hsn_code: '2002', tax_rate: 18, taxable_amt: 211864.41, tax_amt: 38135.59, quantity: 10, unit: 'piece' }],
      },
      {
        ...baseInvoice,
        invoice_number: 'INV-3',
        invoice_date: '2026-11-05',
        total: 590,
        lines: [{ hsn_code: '3003', tax_rate: 18, taxable_amt: 500, tax_amt: 90, quantity: 1, unit: 'piece' }],
      },
      {
        ...baseInvoice,
        invoice_number: 'INV-4',
        invoice_date: '2026-11-06',
        status: 'cancelled',
        total: 100,
        lines: [{ hsn_code: '3003', tax_rate: 18, taxable_amt: 84.75, tax_amt: 15.25, quantity: 1, unit: 'piece' }],
      },
    ],
    credit_notes: [
      {
        note_number: 'CN-1',
        note_date: '2026-11-10',
        reason: 'Sales Return',
        original_invoice_number: 'INV-1',
        customer_gstin: '29PQRST6789K1Z2',
        place_of_supply_state_code: '29',
        is_interstate: false,
        taxable_amt: 1000,
        tax_amt: 180,
        total: 1180,
        tax_rate: 18,
      },
    ],
  })

  it('puts GSTIN sales in B2B grouped by buyer GSTIN', () => {
    expect(result.b2b).toHaveLength(1)
    expect(result.b2b![0].ctin).toBe('29PQRST6789K1Z2')
    const inv = result.b2b![0].inv[0]
    expect(inv.inum).toBe('INV-1')
    expect(inv.idt).toBe('03-11-2026')
    expect(inv.val).toBe(1180)
    expect(inv.itms[0].itm_det).toEqual({ txval: 1000, rt: 18, camt: 90, samt: 90, iamt: 0 })
  })

  it('puts big interstate no-GSTIN sales in B2CL', () => {
    expect(result.b2cl).toHaveLength(1)
    expect(result.b2cl![0].pos).toBe('27')
    expect(result.b2cl![0].inv[0].inum).toBe('INV-2')
    expect(result.b2cl![0].inv[0].itms[0].itm_det.iamt).toBe(38135.59)
  })

  it('aggregates small no-GSTIN sales into B2CS by rate', () => {
    expect(result.b2cs).toHaveLength(1)
    expect(result.b2cs![0]).toMatchObject({
      sply_ty: 'INTRA',
      pos: '29',
      rt: 18,
      txval: 500,
      camt: 45,
      samt: 45,
      iamt: 0,
    })
  })

  it('excludes cancelled bills and says so in meta', () => {
    expect(result.meta.invoice_count).toBe(3)
    expect(result.meta.cancelled_excluded).toBe(1)
    expect(result.meta.warnings.some((w) => w.includes('cancelled'))).toBe(true)
  })

  it('maps registered credit notes to CDNR with split tax', () => {
    expect(result.cdnr).toHaveLength(1)
    const nt = result.cdnr![0].nt[0]
    expect(nt.num).toBe('CN-1')
    expect(nt.itms[0].itm_det).toEqual({ txval: 1000, rt: 18, camt: 90, samt: 90, iamt: 0 })
  })

  it('builds the HSN summary from active bills only', () => {
    const rows = result.hsn!.data
    const hsn1001 = rows.find((r: any) => r.hsn_sc === '1001')
    expect(hsn1001).toMatchObject({ qty: 2, txval: 1000, camt: 90, samt: 90 })
    const hsn3003 = rows.find((r: any) => r.hsn_sc === '3003')
    expect(hsn3003.txval).toBe(500)
  })
})
