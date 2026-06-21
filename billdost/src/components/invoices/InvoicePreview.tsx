'use client'

import { useRef, useImperativeHandle, forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useShop } from '@/components/shared/ShopContext'

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

/* ─── Component ─── */
export const InvoicePreview = forwardRef<InvoicePreviewRef, { data: InvoicePreviewData; shop: ShopData }>(
  ({ data, shop }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const hasMakingCharges = data.items.some(i => (i.making_charge || 0) > 0)
    
    // Default to 'general' if not wrapped in ShopContext
    let shopCategory = 'general'
    try {
      const shopCtx = useShop()
      shopCategory = shopCtx.shopCategory
    } catch (e) {
      // In case it's used outside a context
    }

    const theme = {
      jewellery: {
        fontFamily: 'var(--font-playfair), serif',
        accentColor: '#B8860B', // Dark Goldenrod
        accentText: 'text-[#B8860B]',
        accentBorder: 'border-[#B8860B]',
        headerBg: 'bg-[#FFF8DC]', // Cornsilk
        titleFont: 'font-serif italic',
        tableHeaderBg: 'bg-[#FFF8DC]',
      },
      hardware: {
        fontFamily: 'var(--font-roboto), sans-serif',
        accentColor: '#2C3E50', // Dark Blue/Grey
        accentText: 'text-[#2C3E50]',
        accentBorder: 'border-[#2C3E50]',
        headerBg: 'bg-[#F2F4F4]',
        titleFont: 'font-sans font-black uppercase',
        tableHeaderBg: 'bg-[#E5E7E9]',
      },
      provision: {
        fontFamily: 'var(--font-inter), sans-serif',
        accentColor: '#27AE60', // Nephritis Green
        accentText: 'text-[#27AE60]',
        accentBorder: 'border-[#27AE60]',
        headerBg: 'bg-[#EAFAF1]',
        titleFont: 'font-sans font-extrabold',
        tableHeaderBg: 'bg-[#D5F5E3]',
      },
      cloth: {
        fontFamily: 'var(--font-outfit), sans-serif',
        accentColor: '#8E44AD', // Wisteria Purple
        accentText: 'text-[#8E44AD]',
        accentBorder: 'border-[#8E44AD]',
        headerBg: 'bg-[#F4ECF7]',
        titleFont: 'font-sans font-bold tracking-widest uppercase',
        tableHeaderBg: 'bg-[#E8DAEF]',
      },
      general: {
        fontFamily: 'var(--font-inter), sans-serif',
        accentColor: '#1B7A4A',
        accentText: 'text-[#1B7A4A]',
        accentBorder: 'border-gray-900',
        headerBg: 'bg-transparent',
        titleFont: 'font-sans font-extrabold',
        tableHeaderBg: 'bg-transparent',
      }
    }[shopCategory] || {
        fontFamily: 'var(--font-inter), sans-serif',
        accentColor: '#1B7A4A',
        accentText: 'text-[#1B7A4A]',
        accentBorder: 'border-gray-900',
        headerBg: 'bg-transparent',
        titleFont: 'font-sans font-extrabold',
        tableHeaderBg: 'bg-transparent',
    }

    useImperativeHandle(ref, () => ({
      downloadPDF: async () => {
        if (!containerRef.current) return
        
        // Temporarily prepare for print
        const el = containerRef.current
        const originalScale = el.style.transform
        
        try {
          // Reset scale to 1 to ensure high quality capture
          el.style.transform = 'scale(1)'
          
          const canvas = await html2canvas(el, {
            scale: 2, // High resolution
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          })

          const imgData = canvas.toDataURL('image/jpeg', 1.0)
          
          // A4 dimensions in mm: 210 x 297
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
          
          const pdfWidth = pdf.internal.pageSize.getWidth()
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
          pdf.save(`${data.invoice_number || 'Invoice'}.pdf`)
          
        } finally {
          // Restore original scale
          el.style.transform = originalScale
        }
      },
      sharePDF: async (message?: string) => {
        if (!containerRef.current) return false
        
        const el = containerRef.current
        const originalScale = el.style.transform
        
        try {
          el.style.transform = 'scale(1)'
          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          })

          const imgData = canvas.toDataURL('image/jpeg', 1.0)
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
          const pdfWidth = pdf.internal.pageSize.getWidth()
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
          
          const pdfBlob = pdf.output('blob')
          const file = new File([pdfBlob], `${data.invoice_number || 'Invoice'}.pdf`, { type: 'application/pdf' })
          
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Invoice ${data.invoice_number}`,
              text: message || 'Here is your invoice.',
              files: [file]
            })
            return true
          }
          return false
        } catch (error) {
          console.error("Error sharing PDF:", error)
          return false
        } finally {
          el.style.transform = originalScale
        }
      },
      getPDFBase64: async () => {
        if (!containerRef.current) return null
        
        const el = containerRef.current
        const originalScale = el.style.transform
        
        try {
          el.style.transform = 'scale(1)'
          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          })

          const imgData = canvas.toDataURL('image/jpeg', 1.0)
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
          const pdfWidth = pdf.internal.pageSize.getWidth()
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
          
          return pdf.output('datauristring')
        } catch (error) {
          console.error("Error generating base64 PDF:", error)
          return null
        } finally {
          el.style.transform = originalScale
        }
      }
    }))

    // Construct UPI String for QR
    // Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR
    let upiString = ''
    if (shop?.upi_id && data.include_upi_qr && data.balance_due > 0) {
      const pn = encodeURIComponent(shop.name)
      upiString = `upi://pay?pa=${shop.upi_id}&pn=${pn}&am=${data.balance_due}&cu=INR`
    }

    // Force strictly light mode tailwind classes because PDF needs white background and black text
    return (
      <div className="w-full flex justify-center bg-gray-100 dark:bg-[#161513] overflow-auto p-4 md:p-8 rounded-xl border border-gray-200 dark:border-[#2E2C28]">
        {/* A4 Aspect Ratio Container */}
        <div 
          ref={containerRef}
          className="bg-white text-black shadow-sm origin-top"
          style={{ 
            width: '210mm', 
            minHeight: '297mm', 
            padding: '20mm',
            boxSizing: 'border-box',
            fontFamily: theme.fontFamily
          }}
        >
          {/* --- Header --- */}
          <div className={`flex justify-between items-start border-b-[3px] ${theme.accentBorder} pb-6 mb-6 px-4 pt-4 ${theme.headerBg}`}>
            <div className="max-w-[60%]">
              <h1 className={`text-3xl ${theme.titleFont} ${theme.accentText} tracking-tight`}>{shop?.name || 'Your Shop'}</h1>
              {shop?.address && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{shop.address}</p>}
              {shop?.phone && <p className="text-sm text-gray-700 mt-1">Phone: <span className="font-medium">{shop.phone}</span></p>}
              {shop?.gstin && <p className="text-sm text-gray-700 mt-1">GSTIN: <span className="font-semibold">{shop.gstin}</span></p>}
            </div>
            <div className="text-right">
              <h2 className={`text-4xl ${theme.titleFont} text-gray-300 uppercase tracking-widest mb-2`}>INVOICE</h2>
              <p className="text-sm font-bold text-gray-800">{data.invoice_number || 'INV-XXXX'}</p>
              <p className="text-sm text-gray-600 mt-1">Date: <span className="font-medium text-gray-800">{formatDate(data.invoice_date)}</span></p>
              {data.due_date && (
                <p className="text-sm text-gray-600 mt-1">Due: <span className="font-medium text-gray-800">{formatDate(data.due_date)}</span></p>
              )}
            </div>
          </div>

          {/* --- Customer Info --- */}
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Billed To</h3>
            <p className="text-lg font-bold text-gray-900">{data.customer_name || 'Customer Name'}</p>
            {data.customer_phone && <p className="text-sm text-gray-600 mt-1">{data.customer_phone}</p>}
            {data.customer_address && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{data.customer_address}</p>}
          </div>

          {/* --- Line Items Table --- */}
          <table className="w-full mb-8 text-left border-collapse">
            <thead>
              <tr className={`border-b-2 ${theme.accentBorder} ${theme.tableHeaderBg}`}>
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
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={hasMakingCharges ? 6 : 5} className="py-8 text-center text-sm text-gray-400 italic">No items added yet.</td>
                </tr>
              ) : (
                data.items.map((item, idx) => (
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

          {/* --- Totals & Footer Grid (Table Layout for strict PDF rendering) --- */}
          <table className="w-full mt-8 pt-4 border-t border-gray-100 table-fixed">
            <tbody>
              <tr>
                {/* Left side: Notes & QR */}
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

                {/* Right side: Totals */}
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

                    <div className={`pt-3 mt-3 border-t-[3px] ${theme.accentBorder} flex justify-between items-center`}>
                      <span className="font-bold text-gray-900 uppercase">Total Amount</span>
                      <span className={`text-xl font-black ${theme.accentText}`}>{formatINR(data.total)}</span>
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
          
          {/* Watermark/Footer */}
          <div className="absolute bottom-10 left-0 right-0 text-center">
            <p className="text-[10px] text-gray-400 font-medium">
              Made with <span className="font-bold text-gray-500">BillDost</span> — Free billing software for Indian businesses
            </p>
          </div>
          
        </div>
      </div>
    )
  }
)

InvoicePreview.displayName = 'InvoicePreview'
