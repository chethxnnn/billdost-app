/**
 * Tally XML export (blueprint D9).
 *
 * Builds a TallyPrime "Import Data" envelope with one Sales voucher
 * per invoice, from stored invoice data only: party ledger for the
 * invoice total, a Sales ledger for the taxable value, CGST, SGST
 * and IGST ledger entries for the stored header tax amounts, and
 * one inventory entry per line. Cancelled invoices are skipped.
 * Ledger names follow the common Tally defaults (Sales, CGST, SGST,
 * IGST); the CA maps them if their Tally uses different names.
 */

export interface TallyLineInput {
  name: string
  hsn_code: string | null
  quantity: number
  unit: string
  unit_price: number
  taxable_amt: number
  tax_amt: number
  tax_rate: number
}

export interface TallyInvoiceInput {
  invoice_number: string
  invoice_date: string // YYYY-MM-DD
  customer_name: string
  customer_gstin: string | null
  status: string
  taxable_amt: number
  cgst_amt: number
  sgst_amt: number
  igst_amt: number
  total: number
  lines: TallyLineInput[]
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const amt = (n: number) => (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2)

/** YYYY-MM-DD to Tally's YYYYMMDD. */
export function tallyDate(iso: string): string {
  return iso.replace(/-/g, '')
}

function ledgerEntry(name: string, amount: number, isDeemedPositive: boolean): string {
  const signed = isDeemedPositive ? amt(amount) : `-${amt(amount)}`
  return [
    '      <LEDGERENTRIES.LIST>',
    `        <LEDGERNAME>${escapeXml(name)}</LEDGERNAME>`,
    `        <ISDEEMEDPOSITIVE>${isDeemedPositive ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`,
    `        <AMOUNT>${signed}</AMOUNT>`,
    '      </LEDGERENTRIES.LIST>',
  ].join('\n')
}

function voucherXml(inv: TallyInvoiceInput): string {
  const lines: string[] = []
  lines.push('    <TALLYMESSAGE xmlns:UDF="TallyUDF">')
  lines.push('     <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">')
  lines.push(`      <DATE>${tallyDate(inv.invoice_date)}</DATE>`)
  lines.push('      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>')
  lines.push(`      <VOUCHERNUMBER>${escapeXml(inv.invoice_number)}</VOUCHERNUMBER>`)
  lines.push(`      <PARTYNAME>${escapeXml(inv.customer_name)}</PARTYNAME>`)
  lines.push('      <ISINVOICE>Yes</ISINVOICE>')
  if (inv.customer_gstin) {
    lines.push(`      <PARTYGSTIN>${escapeXml(inv.customer_gstin)}</PARTYGSTIN>`)
  }
  // Party ledger: receivable, negative in Tally voucher convention.
  lines.push(ledgerEntry(inv.customer_name, inv.total, false))
  // Sales ledger: taxable value.
  lines.push(ledgerEntry('Sales', inv.taxable_amt, true))
  if (inv.cgst_amt > 0) lines.push(ledgerEntry('CGST', inv.cgst_amt, true))
  if (inv.sgst_amt > 0) lines.push(ledgerEntry('SGST', inv.sgst_amt, true))
  if (inv.igst_amt > 0) lines.push(ledgerEntry('IGST', inv.igst_amt, true))

  for (const line of inv.lines) {
    const lineAmount = Math.round((line.taxable_amt + Number.EPSILON) * 100) / 100
    lines.push('      <ALLINVENTORYENTRIES.LIST>')
    lines.push(`        <STOCKITEMNAME>${escapeXml(line.name)}</STOCKITEMNAME>`)
    lines.push('        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>')
    lines.push(`        <RATE>${amt(line.unit_price)}/${escapeXml(line.unit)}</RATE>`)
    lines.push(`        <AMOUNT>${amt(lineAmount)}</AMOUNT>`)
    lines.push(
      `        <ACTUALQTY>${line.quantity} ${escapeXml(line.unit)}</ACTUALQTY>`
    )
    lines.push(
      `        <BILLEDQTY>${line.quantity} ${escapeXml(line.unit)}</BILLEDQTY>`
    )
    lines.push('        <ACCOUNTINGALLOCATIONS.LIST>')
    lines.push('          <LEDGERNAME>Sales</LEDGERNAME>')
    lines.push('          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>')
    lines.push(`          <AMOUNT>${amt(lineAmount)}</AMOUNT>`)
    lines.push('        </ACCOUNTINGALLOCATIONS.LIST>')
    lines.push('      </ALLINVENTORYENTRIES.LIST>')
  }

  lines.push('     </VOUCHER>')
  lines.push('    </TALLYMESSAGE>')
  return lines.join('\n')
}

export function buildTallyXml(invoices: TallyInvoiceInput[]): string {
  const active = invoices.filter((i) => i.status !== 'cancelled')
  const parts: string[] = [
    '<ENVELOPE>',
    ' <HEADER>',
    '  <TALLYREQUEST>Import Data</TALLYREQUEST>',
    ' </HEADER>',
    ' <BODY>',
    '  <IMPORTDATA>',
    '   <REQUESTDESC>',
    '    <REPORTNAME>Vouchers</REPORTNAME>',
    '   </REQUESTDESC>',
    '   <REQUESTDATA>',
    ...active.map(voucherXml),
    '   </REQUESTDATA>',
    '  </IMPORTDATA>',
    ' </BODY>',
    '</ENVELOPE>',
  ]
  return parts.join('\n')
}
