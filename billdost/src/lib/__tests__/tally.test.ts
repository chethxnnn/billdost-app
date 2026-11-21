import { describe, expect, it } from 'vitest'
import { buildTallyXml, escapeXml, tallyDate } from '../tally'

describe('escapeXml and tallyDate', () => {
  it('escapes all XML specials', () => {
    expect(escapeXml('A & B <Kirana> "Store"')).toBe(
      'A &amp; B &lt;Kirana&gt; &quot;Store&quot;'
    )
  })

  it('formats the date as YYYYMMDD', () => {
    expect(tallyDate('2026-11-05')).toBe('20261105')
  })
})

describe('buildTallyXml', () => {
  const xml = buildTallyXml([
    {
      invoice_number: 'INV-1001',
      invoice_date: '2026-11-05',
      customer_name: 'Ram & Sons',
      customer_gstin: '29PQRST6789K1Z2',
      status: 'active',
      taxable_amt: 1000,
      cgst_amt: 90,
      sgst_amt: 90,
      igst_amt: 0,
      total: 1180,
      lines: [
        {
          name: 'Atta 10kg',
          hsn_code: '1101',
          quantity: 2,
          unit: 'piece',
          unit_price: 500,
          taxable_amt: 1000,
          tax_amt: 180,
          tax_rate: 18,
        },
      ],
    },
    {
      invoice_number: 'INV-1002',
      invoice_date: '2026-11-06',
      customer_name: 'Cancelled Customer',
      customer_gstin: null,
      status: 'cancelled',
      taxable_amt: 100,
      cgst_amt: 9,
      sgst_amt: 9,
      igst_amt: 0,
      total: 118,
      lines: [],
    },
  ])

  it('creates one Sales voucher with party, sales and tax ledgers', () => {
    expect(xml).toContain('<VOUCHERNUMBER>INV-1001</VOUCHERNUMBER>')
    expect(xml).toContain('<PARTYNAME>Ram &amp; Sons</PARTYNAME>')
    expect(xml).toContain('<PARTYGSTIN>29PQRST6789K1Z2</PARTYGSTIN>')
    expect(xml).toContain('<LEDGERNAME>CGST</LEDGERNAME>')
    expect(xml).toContain('<LEDGERNAME>SGST</LEDGERNAME>')
    expect(xml).not.toContain('<LEDGERNAME>IGST</LEDGERNAME>')
    expect(xml).toContain('<AMOUNT>-1180.00</AMOUNT>')
    expect(xml).toContain('<STOCKITEMNAME>Atta 10kg</STOCKITEMNAME>')
    expect(xml).toContain('<DATE>20261105</DATE>')
  })

  it('skips cancelled invoices', () => {
    expect(xml).not.toContain('INV-1002')
    expect(xml).not.toContain('Cancelled Customer')
  })
})
