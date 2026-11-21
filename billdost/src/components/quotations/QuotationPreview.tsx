'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
// PDF libraries (html2canvas-pro, jspdf) are loaded on demand inside
// generatePDF; they never ship in the quotation page bundle.
import { paginateArray } from '@/lib/paginate'

export type QuotationPreviewData = {
  customer_name: string
  customer_phone?: string | null
  customer_address?: string | null
  quotation_number: string
  /** The quotation's own date (created_at). Before Stage 3 the PDF
   *  printed the day it was downloaded, so a re-downloaded estimate
   *  silently changed its date. */
  quotation_date?: string | null
  valid_until?: string | null
  items: Array<{
    name: string
    quantity: number
    unit_price: number
    total: number
  }>
  subtotal: number
  discount_pct: number
  discount_amt: number
  total: number
  notes?: string | null
}

export type QuotationPreviewRef = {
  downloadPDF: () => Promise<void>
  getPDFBlob: () => Promise<Blob>
  getPDFBase64: () => Promise<string | null>
}

const A4_W = 794
const A4_H = 1123
const PAGE_GAP = 24

const formatDate = (d?: string | null) => {
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
  } catch {
    return ''
  }
}

/**
 * Paginated like InvoicePreview (lib/paginate): one exact A4 div per
 * page, captured page by page, so a long estimate is never squashed
 * into a single page image. Self-scaling fit-to-width preview.
 */
export const QuotationPreview = forwardRef<QuotationPreviewRef, { data: QuotationPreviewData, shop: any }>(
  ({ data, shop }, ref) => {
    const wrapRef = useRef<HTMLDivElement>(null)
    const scaleRef = useRef<HTMLDivElement>(null)
    const pageRefs = useRef<Array<HTMLDivElement | null>>([])
    const [scale, setScale] = useState(1)

    const pages = paginateArray(data.items)
    const pageCount = pages.length
    const pageStarts: number[] = []
    pages.reduce((acc, page) => {
      pageStarts.push(acc)
      return acc + page.length
    }, 0)

    useEffect(() => {
      const el = wrapRef.current
      if (!el) return
      const update = () => setScale(Math.min(1, el.clientWidth / A4_W))
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    const generatePDF = async () => {
      const scaleEl = scaleRef.current
      if (!scaleEl) throw new Error('Preview not ready')
      const originalTransform = scaleEl.style.transform
      try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas-pro'),
          import('jspdf'),
        ])
        scaleEl.style.transform = 'none'
        const pdf = new jsPDF('p', 'mm', 'a4')
        for (let i = 0; i < pageCount; i++) {
          const pageEl = pageRefs.current[i]
          if (!pageEl) continue
          const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
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
        const pdf = await generatePDF()
        pdf.save(`${data.quotation_number}.pdf`)
      },
      getPDFBlob: async () => {
        const pdf = await generatePDF()
        return pdf.output('blob')
      },
      getPDFBase64: async () => {
        try {
          const pdf = await generatePDF()
          return pdf ? pdf.output('datauristring') : null
        } catch (error) {
          console.error('Error generating base64 PDF:', error)
          return null
        }
      },
    }))

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
                      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
                        <div>
                          <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase mb-1">{shop.name}</h1>
                          <p className="text-sm text-gray-600 whitespace-pre-line">{shop.address}</p>
                          {shop.phone && <p className="text-sm text-gray-600 mt-1">Phone: {shop.phone}</p>}
                          {shop.gstin && <p className="text-sm text-gray-600 mt-1">GSTIN: {shop.gstin}</p>}
                        </div>
                        <div className="text-right">
                          <h2 className="text-3xl font-black text-[#1B7A4A] tracking-widest uppercase mb-2">QUOTATION</h2>
                          <p className="text-sm font-bold text-gray-800">No: {data.quotation_number}</p>
                          <p className="text-sm text-gray-600">Date: {formatDate(data.quotation_date)}</p>
                          {data.valid_until && (
                            <p className="text-sm text-red-600 font-semibold mt-1">Valid Till: {formatDate(data.valid_until)}</p>
                          )}
                        </div>
                      </div>

                      <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Estimate For:</p>
                        <p className="text-lg font-bold text-gray-900">{data.customer_name}</p>
                        {data.customer_phone && <p className="text-sm text-gray-700">{data.customer_phone}</p>}
                        {data.customer_address && <p className="text-sm text-gray-700 mt-1">{data.customer_address}</p>}
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center border-b-2 border-gray-800 pb-3 mb-5">
                      <p className="text-base font-extrabold text-[#1B7A4A]">{shop.name}</p>
                      <p className="text-sm text-gray-600">
                        Quotation <span className="font-bold text-gray-800">{data.quotation_number}</span> · Page {pageIdx + 1} of {pageCount}
                      </p>
                    </div>
                  )}

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="py-3 px-4 text-left font-bold w-12">Sr No</th>
                        <th className="py-3 px-4 text-left font-bold">Items</th>
                        <th className="py-3 px-4 text-center font-bold w-24">Quantities</th>
                        <th className="py-3 px-4 text-right font-bold w-32">Price</th>
                        <th className="py-3 px-4 text-right font-bold w-32">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-200">
                          <td className="py-3 px-4 text-center text-gray-500">{pageStarts[pageIdx] + idx + 1}</td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{item.name}</td>
                          <td className="py-3 px-4 text-center text-gray-700">{item.quantity}</td>
                          <td className="py-3 px-4 text-right text-gray-700">₹{item.unit_price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">₹{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!isLast && <p className="text-xs text-gray-400 italic mt-4">Continued on next page...</p>}

                  {isLast && (
                    <>
                      <div className="flex justify-end mt-8 mb-10">
                        <div className="w-72 bg-gray-50 p-4 rounded-xl border border-gray-200">
                          <div className="flex justify-between py-1 text-sm text-gray-600">
                            <span>Subtotal</span>
                            <span>₹{data.subtotal.toFixed(2)}</span>
                          </div>
                          {data.discount_amt > 0 && (
                            <div className="flex justify-between py-1 text-sm text-red-600">
                              <span>Discount ({data.discount_pct}%)</span>
                              <span>-₹{data.discount_amt.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between py-3 mt-2 border-t-2 border-gray-800 font-black text-lg text-gray-900">
                            <span>Total Estimate</span>
                            <span>₹{data.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {data.notes && (
                        <div className="mb-8">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes:</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">{data.notes}</p>
                        </div>
                      )}

                      {shop?.terms_conditions && (
                        <div className="mb-8">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Terms &amp; Conditions:</p>
                          <p className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">{shop.terms_conditions}</p>
                        </div>
                      )}

                      <p className="text-xs text-gray-400">This is an estimate, not a tax invoice. Prices may be subject to change.</p>
                    </>
                  )}

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

QuotationPreview.displayName = 'QuotationPreview'
