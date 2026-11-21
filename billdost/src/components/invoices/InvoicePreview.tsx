'use client'

import { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
type JsPdfDoc = InstanceType<typeof import('jspdf').jsPDF>
import { paginateArray } from '@/lib/paginate'

/* ─── Types ─── */
export interface InvoicePreviewData {
  customer_name: string
  customer_phone?: string | null
  customer_address?: string | null
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  items: Array<{
    name: string
    quantity: number
    unit_price: number
    making_charge?: number | null
    tax_rate: number
    tax_amt: number
    total: number
  }>
  subtotal: number
  discount_pct: number
  discount_amt: number
  cgst_amt: number
  sgst_amt: number
  igst_amt?: number
  total: number
  amount_paid: number
  balance_due: number
  payment_status: 'unpaid' | 'partial' | 'paid'
  include_upi_qr: boolean
  notes?: string | null
}

export interface ShopData {
  name: string
  address?: string | null
  phone?: string | null
  gstin?: string | null
  upi_id?: string | null
  logo_url?: string | null
  terms_conditions?: string | null
}

export interface InvoicePreviewRef {
  downloadPDF: () => Promise<void>
  sharePDF: (message?: string) => Promise<boolean>
  getPDFBase64: () => Promise<string | null>
}

/* ─── Helpers ─── */
const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

const formatDate = (d: string) => {
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
  } catch {
    return d
  }
}

// A4 at 96dpi. Pages are exact A4 so each captured page maps 1:1 onto
// a PDF page: no squashing, no cropping, however long the bill is.
const A4_W = 794
const A4_H = 1123
const PAGE_GAP = 24

/**
 * One clean invoice design for every shop (Stage 3 decision): the old
 * per-category theme map could never trigger (its keys did not match
 * the onboarding categories) and per-category invoice designs are the
 * parked post-build category pack. Pagination is real: items split
 * across fixed A4 pages via lib/paginate, totals and terms live on
 * the last page, and the footer is the shop's own name and phone,
 * never an ad for the software.
 */
export const InvoicePreview = forwardRef<InvoicePreviewRef, { data: InvoicePreviewData; shop: ShopData }>(
  ({ data, shop }, ref) => {
    const wrapRef = useRef<HTMLDivElement>(null)
    const scaleRef = useRef<HTMLDivElement>(null)
    const pageRefs = useRef<Array<HTMLDivElement | null>>([])
    const [scale, setScale] = useState(1)

    const hasMakingCharges = data.items.some((i) => (i.making_charge || 0) > 0)
    const pages = paginateArray(data.items)
    const pageCount = pages.length

    // Fit-to-width scaling: the preview measures its own container and
    // scales the A4 pages to fit, readable on a phone. Callers no
    // longer wrap it in fixed scale(0.6/0.8/0.9) transforms.
    useEffect(() => {
      const el = wrapRef.current
      if (!el) return
      const update = () => setScale(Math.min(1, el.clientWidth / A4_W))
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    const buildPDF = async (): Promise<JsPdfDoc | null> => {
      const scaleEl = scaleRef.current
      if (!scaleEl) return null
      const originalTransform = scaleEl.style.transform
      try {
        // Heavy PDF libraries load on demand, only when a PDF is
        // actually generated, never in the billing page bundle.
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas-pro'),
          import('jspdf'),
        ])
        scaleEl.style.transform = 'none'
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        for (let i = 0; i < pageCount; i++) {
          const pageEl = pageRefs.current[i]
          if (!pageEl) continue
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          })
          const imgData = canvas.toDataURL('image/jpeg', 1.0)
          if (i > 0) pdf.addPage()
          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297)
        }
        return pdf
      } finally {
        scaleEl.style.transform = originalTransform
      }
    }

    useImperativeHandle(ref, () => ({
      downloadPDF: async () => {
        const pdf = await buildPDF()
        if (pdf) pdf.save(`${data.invoice_number || 'Invoice'}.pdf`)
      },
      sharePDF: async (message?: string) => {
        try {
          const pdf = await buildPDF()
          if (!pdf) return false
          const pdfBlob = pdf.output('blob')
          const file = new File([pdfBlob], `${data.invoice_number || 'Invoice'}.pdf`, { type: 'application/pdf' })
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Invoice ${data.invoice_number}`,
              text: message || 'Here is your invoice.',
              files: [file],
            })
            return true
          }
          return false
        } catch (error) {
          console.error('Error sharing PDF:', error)
          return false
        }
      },
      getPDFBase64: async () => {
        try {
          const pdf = await buildPDF()
          return pdf ? pdf.output('datauristring') : null
        } catch (error) {
          console.error('Error generating base64 PDF:', error)
          return null
        }
      },
    }))

    // Construct UPI String for QR: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR
    let upiString = ''
    if (shop?.upi_id && data.include_upi_qr && data.balance_due > 0) {
      const pn = encodeURIComponent(shop.name)
      upiString = `upi://pay?pa=${shop.upi_id}&pn=${pn}&am=${data.balance_due}&cu=INR`
    }

    const totalHeight = pageCount * A4_H + (pageCount - 1) * PAGE_GAP

    return (
      <div ref={wrapRef} className="w-full overflow-hidden">
        <div style={{ height: totalHeight * scale }} className="relative">
          <div
            ref={scaleRef}
            style={{
              width: A4_W,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              fontFamily: 'var(--font-inter), sans-serif',
            }}
            className="absolute left-0 top-0"
          >
            {pages.map((pageItems, pageIdx) => {
              const isFirst = pageIdx === 0
              const isLast = pageIdx === pageCount - 1
              return (
                <div
                  key={pageIdx}
                  ref={(el) => {
                    pageRefs.current[pageIdx] = el
                  }}
                  className="bg-white text-black shadow-sm flex flex-col"
                  style={{
                    width: A4_W,
                    height: A4_H,
                    padding: '48px 56px',
                    boxSizing: 'border-box',
                    marginBottom: isLast ? 0 : PAGE_GAP,
                  }}
                >
                  {isFirst ? (
                    <>
                      {/* --- Full header, page 1 --- */}
                      <div className="flex justify-between items-start border-b-[3px] border-gray-900 pb-6 mb-6">
                        <div className="max-w-[60%]">
                          {shop?.logo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={shop.logo_url} alt="" style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain' }} className="mb-3" />
                          )}
                          <h1 className="text-3xl font-extrabold text-[#1B7A4A] tracking-tight">{shop?.name || 'Your Shop'}</h1>
                          {shop?.address && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{shop.address}</p>}
                          {shop?.phone && <p className="text-sm text-gray-700 mt-1">Phone: <span className="font-medium">{shop.phone}</span></p>}
                          {shop?.gstin && <p className="text-sm text-gray-700 mt-1">GSTIN: <span className="font-semibold">{shop.gstin}</span></p>}
                        </div>
                        <div className="text-right">
                          <h2 className="text-4xl font-extrabold text-gray-300 uppercase tracking-widest mb-2">INVOICE</h2>
                          <p className="text-sm font-bold text-gray-800">{data.invoice_number || 'INV-XXXX'}</p>
                          <p className="text-sm text-gray-600 mt-1">Date: <span className="font-medium text-gray-800">{formatDate(data.invoice_date)}</span></p>
                          {data.due_date && (
                            <p className="text-sm text-gray-600 mt-1">Due: <span className="font-medium text-gray-800">{formatDate(data.due_date)}</span></p>
                          )}
                        </div>
                      </div>

                      {/* --- Customer --- */}
                      <div className="mb-8">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Billed To</h3>
                        <p className="text-lg font-bold text-gray-900">{data.customer_name || 'Customer Name'}</p>
                        {data.customer_phone && <p className="text-sm text-gray-600 mt-1">{data.customer_phone}</p>}
                        {data.customer_address && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{data.customer_address}</p>}
                      </div>
                    </>
                  ) : (
                    /* --- Slim continuation header --- */
                    <div className="flex justify-between items-center border-b-2 border-gray-900 pb-3 mb-5">
                      <p className="text-base font-extrabold text-[#1B7A4A]">{shop?.name || 'Your Shop'}</p>
                      <p className="text-sm text-gray-600">
                        Invoice <span className="font-bold text-gray-800">{data.invoice_number}</span> · Page {pageIdx + 1} of {pageCount}
                      </p>
                    </div>
                  )}

                  {/* --- Line items for this page --- */}
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-900">
                        <th className="py-3 px-2 text-xs font-bold text-gray-800 uppercase tracking-wider">Item</th>
                        <th className="py-3 px-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Qty</th>
                        <th className="py-3 px-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Rate</th>
                        {hasMakingCharges && (
                          <th className="py-3 px-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Making</th>
                        )}
                        <th className="py-3 px-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">GST</th>
                        <th className="py-3 px-2 text-xs font-bold text-gray-800 uppercase tracking-wider text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={hasMakingCharges ? 6 : 5} className="py-8 text-center text-sm text-gray-400 italic">No items added yet.</td>
                        </tr>
                      ) : (
                        pageItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-3 px-2 text-sm text-gray-900 font-medium">{item.name || 'Untitled Item'}</td>
                            <td className="py-3 px-2 text-sm text-gray-700 text-right">{item.quantity}</td>
                            <td className="py-3 px-2 text-sm text-gray-700 text-right">{formatINR(item.unit_price)}</td>
                            {hasMakingCharges && (
                              <td className="py-3 px-2 text-sm text-gray-700 text-right">{item.making_charge ? formatINR(item.making_charge) : '-'}</td>
                            )}
                            <td className="py-3 px-2 text-sm text-gray-500 text-right">{item.tax_rate > 0 ? `${item.tax_rate}%` : '-'}</td>
                            <td className="py-3 px-2 text-sm text-gray-900 font-bold text-right">{formatINR(item.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {!isLast && (
                    <p className="text-xs text-gray-400 italic mt-4">Continued on next page...</p>
                  )}

                  {/* --- Totals, notes, QR, terms: last page only --- */}
                  {isLast && (
                    <>
                      <table className="w-full mt-8 pt-4 border-t border-gray-100 table-fixed">
                        <tbody>
                          <tr>
                            <td className="w-1/2 align-top pr-8">
                              {data.notes && (
                                <div className="mb-6">
                                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Notes</h3>
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.notes}</p>
                                </div>
                              )}

                              {upiString && (
                                <div className="mt-2 p-4 border border-gray-200 rounded-xl bg-gray-50">
                                  <div className="flex items-center gap-4">
                                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm flex-shrink-0">
                                      <QRCodeSVG value={upiString} size={80} level="M" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">Scan to Pay</p>
                                      <p className="text-xs text-gray-500 mb-1">UPI: <span className="font-medium text-gray-800">{shop.upi_id}</span></p>
                                      <p className="text-sm font-black text-gray-900">{formatINR(data.balance_due)}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {data.payment_status === 'paid' && (
                                <div className="mt-4 inline-block px-4 py-2 border-2 border-green-500 text-green-600 rounded-lg transform -rotate-2">
                                  <span className="text-lg font-black uppercase tracking-widest">PAID IN FULL</span>
                                </div>
                              )}
                            </td>

                            <td className="w-1/2 align-top pl-8">
                              <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-gray-600">
                                  <span>Subtotal</span>
                                  <span className="font-medium">{formatINR(data.subtotal)}</span>
                                </div>

                                {data.discount_amt > 0 && (
                                  <div className="flex justify-between text-green-600">
                                    <span>Discount ({data.discount_pct}%)</span>
                                    <span>-{formatINR(data.discount_amt)}</span>
                                  </div>
                                )}

                                {data.cgst_amt > 0 && (
                                  <div className="flex justify-between text-gray-600">
                                    <span>CGST</span>
                                    <span>{formatINR(data.cgst_amt)}</span>
                                  </div>
                                )}

                                {data.sgst_amt > 0 && (
                                  <div className="flex justify-between text-gray-600">
                                    <span>SGST</span>
                                    <span>{formatINR(data.sgst_amt)}</span>
                                  </div>
                                )}

                                {(data.igst_amt || 0) > 0 && (
                                  <div className="flex justify-between text-gray-600">
                                    <span>IGST</span>
                                    <span>{formatINR(data.igst_amt || 0)}</span>
                                  </div>
                                )}

                                <div className="pt-3 mt-3 border-t-[3px] border-gray-900 flex justify-between items-center">
                                  <span className="font-bold text-gray-900 uppercase">Total Amount</span>
                                  <span className="text-xl font-black text-[#1B7A4A]">{formatINR(data.total)}</span>
                                </div>

                                {data.amount_paid > 0 && (
                                  <div className="flex justify-between text-green-600 font-medium pt-2">
                                    <span>Amount Paid</span>
                                    <span>{formatINR(data.amount_paid)}</span>
                                  </div>
                                )}

                                {(data.balance_due > 0 || data.amount_paid > 0) && (
                                  <div className="flex justify-between text-red-600 font-bold pt-2 border-t border-gray-100 mt-2">
                                    <span>Balance Due</span>
                                    <span>{formatINR(data.balance_due)}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Terms and conditions from the shop's own settings
                          (editable in Settings; never rendered before). */}
                      {shop?.terms_conditions && (
                        <div className="mt-8">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Terms &amp; Conditions</h3>
                          <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{shop.terms_conditions}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Shop-first footer on every page. The old footer
                      advertised the software itself on the shop's own
                      bill to its own customer. */}
                  <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-400">
                    <span className="font-semibold text-gray-500">
                      {shop?.name || ''}
                      {shop?.phone ? ` · ${shop.phone}` : ''}
                    </span>
                    <span>
                      Page {pageIdx + 1} of {pageCount}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }
)

InvoicePreview.displayName = 'InvoicePreview'
