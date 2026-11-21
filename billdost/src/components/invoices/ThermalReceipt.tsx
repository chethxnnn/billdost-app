'use client'

import { QRCodeSVG } from 'qrcode.react'
import {
  padReceiptRow,
  receiptCharsPerLine,
  receiptDivider,
  receiptItemLines,
  wrapReceiptText,
} from '@/lib/thermal'

export interface ThermalInvoiceData {
  invoice_number: string
  invoice_date: string
  customer_name: string
  customer_phone?: string | null
  subtotal: number
  discount_amt: number
  taxable_amt: number
  cgst_amt: number
  sgst_amt: number
  igst_amt: number
  round_off_amt: number
  total: number
  amount_paid: number
  balance_due: number
  items: Array<{
    name: string
    quantity: number
    unit_price: number
    total: number
  }>
}

export interface ThermalShopData {
  name: string
  address?: string | null
  phone?: string | null
  gstin?: string | null
  upi_id?: string | null
  terms_conditions?: string | null
  thermal_width?: number | null
  print_upi_qr?: boolean | null
}

const money = (n: number) =>
  `Rs.${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Thermal receipt (blueprint D3): a fixed-width monospace rendering of
 * the same stored invoice the A4 PDF shows. Amounts come from the
 * invoice row the server computed; nothing is recomputed here. Width
 * follows the shop paper setting (58 or 80 mm).
 */
export function ThermalReceipt({
  invoice,
  shop,
}: {
  invoice: ThermalInvoiceData
  shop: ThermalShopData
}) {
  const widthMm = shop.thermal_width === 58 ? 58 : 80
  const chars = receiptCharsPerLine(widthMm as 58 | 80)
  const divider = receiptDivider(chars)
  const showQr =
    shop.print_upi_qr !== false &&
    Boolean(shop.upi_id) &&
    Number(invoice.balance_due) > 0
  const upiUrl = shop.upi_id
    ? `upi://pay?pa=${encodeURIComponent(shop.upi_id)}&pn=${encodeURIComponent(shop.name)}&am=${Number(invoice.balance_due).toFixed(2)}&cu=INR`
    : ''

  const lines: string[] = []
  lines.push(divider)
  lines.push(padReceiptRow(`Bill: ${invoice.invoice_number}`, String(invoice.invoice_date), chars))
  lines.push(padReceiptRow('Customer:', invoice.customer_name.slice(0, chars - 10), chars))
  if (invoice.customer_phone) lines.push(`Phone: ${invoice.customer_phone}`)
  lines.push(divider)
  for (const item of invoice.items) {
    lines.push(
      ...receiptItemLines({
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        amount: Number(item.total),
        width: chars,
        formatAmount: money,
      })
    )
  }
  lines.push(divider)
  if (Number(invoice.discount_amt) > 0) {
    lines.push(padReceiptRow('Discount', `-${money(invoice.discount_amt)}`, chars))
  }
  lines.push(padReceiptRow('Taxable', money(invoice.taxable_amt), chars))
  if (Number(invoice.igst_amt) > 0) {
    lines.push(padReceiptRow('IGST', money(invoice.igst_amt), chars))
  } else {
    if (Number(invoice.cgst_amt) > 0) lines.push(padReceiptRow('CGST', money(invoice.cgst_amt), chars))
    if (Number(invoice.sgst_amt) > 0) lines.push(padReceiptRow('SGST', money(invoice.sgst_amt), chars))
  }
  if (Number(invoice.round_off_amt) !== 0) {
    lines.push(padReceiptRow('Round Off', money(invoice.round_off_amt), chars))
  }
  lines.push(receiptDivider(chars, '='))
  lines.push(padReceiptRow('TOTAL', money(invoice.total), chars))
  lines.push(padReceiptRow('Paid', money(invoice.amount_paid), chars))
  if (Number(invoice.balance_due) > 0) {
    lines.push(padReceiptRow('BALANCE DUE', money(invoice.balance_due), chars))
  }
  lines.push(divider)

  return (
    <div
      className="thermal-receipt bg-white text-black mx-auto"
      style={{
        width: `${widthMm}mm`,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: widthMm === 58 ? '11px' : '12px',
        lineHeight: 1.45,
        padding: '3mm 2mm',
      }}
    >
      <div className="text-center">
        <div style={{ fontSize: widthMm === 58 ? '15px' : '17px', fontWeight: 800 }}>
          {shop.name}
        </div>
        {shop.address &&
          wrapReceiptText(shop.address, chars).map((l, i) => <div key={i}>{l}</div>)}
        {shop.phone && <div>Phone: {shop.phone}</div>}
        {shop.gstin && <div>GSTIN: {shop.gstin}</div>}
      </div>

      <pre className="whitespace-pre-wrap break-words" style={{ font: 'inherit', margin: '2mm 0' }}>
        {lines.join('\n')}
      </pre>

      {showQr && (
        <div className="text-center" style={{ marginTop: '2mm' }}>
          <QRCodeSVG value={upiUrl} size={widthMm === 58 ? 96 : 120} className="mx-auto" />
          <div>Scan karke balance pay karo</div>
          <div>{shop.upi_id}</div>
        </div>
      )}

      {shop.terms_conditions && (
        <div className="text-center" style={{ marginTop: '2mm', fontSize: '10px' }}>
          {wrapReceiptText(shop.terms_conditions.replace(/\s*\n\s*/g, ' '), chars).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}

      <div className="text-center" style={{ marginTop: '3mm', fontWeight: 700 }}>
        Dhanyavaad! Phir zaroor aana.
      </div>
    </div>
  )
}
