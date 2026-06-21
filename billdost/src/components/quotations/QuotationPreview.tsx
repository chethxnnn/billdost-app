'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export type QuotationPreviewData = {
  customer_name: string
  customer_phone?: string | null
  customer_address?: string | null
  quotation_number: string
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
}

export const QuotationPreview = forwardRef<QuotationPreviewRef, { data: QuotationPreviewData, shop: any }>(
  ({ data, shop }, ref) => {
    const printRef = useRef<HTMLDivElement>(null)

    const generatePDF = async () => {
      if (!printRef.current) throw new Error('Preview not ready')
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      return pdf
    }

    useImperativeHandle(ref, () => ({
      downloadPDF: async () => {
        const pdf = await generatePDF()
        pdf.save(`${data.quotation_number}.pdf`)
      },
      getPDFBlob: async () => {
        const pdf = await generatePDF()
        return pdf.output('blob')
      }
    }))

    return (
      <div 
        ref={printRef}
        className="bg-white w-[210mm] min-h-[297mm] text-black p-10 font-sans mx-auto shadow-sm"
        style={{ boxSizing: 'border-box' }}
      >
        {/* Header Section */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase mb-1">{shop.name}</h1>
            <p className="text-sm text-gray-600 whitespace-pre-line">{shop.address}</p>
            {shop.phone && <p className="text-sm text-gray-600 mt-1">Phone: {shop.phone}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-black text-[#1B7A4A] tracking-widest uppercase mb-2">QUOTATION</h2>
            <p className="text-sm font-bold text-gray-800">No: {data.quotation_number}</p>
            <p className="text-sm text-gray-600">Date: {new Date().toLocaleDateString('en-IN')}</p>
            {data.valid_until && (
              <p className="text-sm text-red-600 font-semibold mt-1">Valid Till: {new Date(data.valid_until).toLocaleDateString('en-IN')}</p>
            )}
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Estimate For:</p>
          <p className="text-lg font-bold text-gray-900">{data.customer_name}</p>
          {data.customer_phone && <p className="text-sm text-gray-700">{data.customer_phone}</p>}
          {data.customer_address && <p className="text-sm text-gray-700 mt-1">{data.customer_address}</p>}
        </div>

        {/* Items Table */}
        <table className="w-full mb-8 text-sm">
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
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-3 px-4 text-center text-gray-500">{idx + 1}</td>
                <td className="py-3 px-4 font-semibold text-gray-900">{item.name}</td>
                <td className="py-3 px-4 text-center text-gray-700">{item.quantity}</td>
                <td className="py-3 px-4 text-right text-gray-700">₹{item.unit_price.toFixed(2)}</td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">₹{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section */}
        <div className="flex justify-end mb-10">
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

        {/* Footer/Notes */}
        {data.notes && (
          <div className="mb-8">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes & Terms:</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{data.notes}</p>
          </div>
        )}
        
        <div className="mt-16 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
          This is an estimate, not a tax invoice. Prices may be subject to change.
          <br />Generated via BillDost.in
        </div>
      </div>
    )
  }
)

QuotationPreview.displayName = 'QuotationPreview'
