'use client'

import { useRef, use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { InvoicePreview, InvoicePreviewRef } from '@/components/invoices/InvoicePreview'

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const utils = trpc.useUtils ? trpc.useUtils() : (trpc as any).useContext()
  const { id } = use(params)
  const previewRef = useRef<InvoicePreviewRef>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('')
  const [paymentMode, setPaymentMode] = useState('cash')

  const { data: invoiceData, isLoading, error } = trpc.invoices.get.useQuery(
    { id },
    { enabled: !!id }
  )
  const paymentMut = trpc.invoices.recordPayment.useMutation()

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading...</div>
  if (error || !invoiceData) return <div className="p-8 text-center text-red-500">Error loading invoice</div>

  const { items, shop, ...invoice } = invoiceData

  const handleDownload = async () => {
    if (previewRef.current) await previewRef.current.downloadPDF()
  }

  const handleWhatsApp = async () => {
    if (!invoice.customer_phone) {
      toast.error("Customer ka phone number nahi hai!")
      return
    }
    const message = `Hello ${invoice.customer_name},\n\nAapka bill (No: ${invoice.invoice_number}) ₹${invoice.total} ka ready hai.\n\nRegards,\n${shop?.name || 'Apni Dukaan'}`
    
    // 1. Check if WhatsApp Microservice is connected for this shop
    const targetShopId = shop?.id || (invoice as any).shop_id
    const waUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || 'http://localhost:3001'
    try {
      if (targetShopId) {
        const statusRes = await fetch(`${waUrl}/api/whatsapp/${targetShopId}/status`)
        const statusData = await statusRes.json()

        if (statusData.status === 'READY') {
          if (!previewRef.current) {
            toast.error("Invoice preview loading, please try again in a moment.")
            return
          }

          toast.loading("Sending automated WhatsApp message with PDF bill...", { id: 'wa-send' })
          
          // Generate PDF
          const pdfBase64 = await previewRef.current.getPDFBase64()
          
          if (!pdfBase64) {
            toast.error("Failed to generate invoice PDF", { id: 'wa-send' })
            return
          }

          // Send via microservice
          const sendRes = await fetch(`${waUrl}/api/whatsapp/${targetShopId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: invoice.customer_phone,
              message,
              pdfBase64,
              filename: `${invoice.invoice_number}.pdf`
            })
          })

          const sendData = await sendRes.json()

          if (sendRes.ok && sendData.success) {
            toast.success("WhatsApp message sent directly to customer!", { id: 'wa-send' })
            return // Direct send complete — NO tab redirection!
          } else {
            toast.error(sendData.error || "Failed to send WhatsApp message", { id: 'wa-send' })
            return
          }
        } else {
          console.warn("WhatsApp status is not READY:", statusData.status)
          toast.warning("WhatsApp device is not linked yet! Please link in Settings > WhatsApp to send directly in the background.", { duration: 5000 })
        }
      }
    } catch (err) {
      console.error("Microservice error:", err)
      toast.dismiss('wa-send')
    }

    // 2. Fallback to Native File Share (Mobile)
    if (previewRef.current) {
      toast.loading("Preparing PDF to share...", { id: 'share' })
      const shared = await previewRef.current.sharePDF(message)
      toast.dismiss('share')
      if (shared) return // Native share succeeded, no need for wa.me fallback
    }

    // 3. Ultimate Fallback (Desktop WA Web when microservice is not connected)
    toast.info("WhatsApp microservice not connected. Opening WhatsApp Web...")
    const url = `https://wa.me/91${invoice.customer_phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleRecordPayment = async () => {
    const amt = Number(paymentAmount)
    if (!amt || amt <= 0 || amt > Number(invoice.balance_due)) {
      toast.error(`Please enter a valid amount up to ₹${invoice.balance_due}`)
      return
    }
    
    try {
      await paymentMut.mutateAsync({
        id,
        amount_paid: amt,
        payment_mode: paymentMode
      })
      toast.success('Payment recorded successfully!')
      setShowPaymentForm(false)
      utils.invoices.get.invalidate({ id })
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const isPaid = invoice.payment_status === 'paid'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/invoices" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">← Back</Link>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
            Invoice {invoice.invoice_number}
          </h1>
          {isPaid && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Paid</span>}
          {!isPaid && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Unpaid</span>}
        </div>
        
        <div className="flex gap-2">
          {!isPaid && !showPaymentForm && (
            <button 
              onClick={() => {
                setPaymentAmount(Number(invoice.balance_due))
                setShowPaymentForm(true)
              }}
              className="bg-[#1B7A4A] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#155F3A] transition-colors"
            >
              Record Payment
            </button>
          )}
          <button 
            onClick={handleWhatsApp}
            className="bg-[#25D366]/10 text-[#25D366] px-4 py-2 rounded-xl font-bold hover:bg-[#25D366]/20 transition-colors"
          >
            Send WhatsApp
          </button>
          <button 
            onClick={handleDownload}
            className="bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2E2C28] px-4 py-2 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-[#252320] transition-colors"
          >
            Download PDF
          </button>
        </div>
      </div>

      {showPaymentForm && (
        <div className="bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase mb-4">Record New Payment</h3>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amount Received (Max: ₹{invoice.balance_due})</label>
              <input 
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Payment Mode</label>
              <select 
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI / Online</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setShowPaymentForm(false)}
                className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-[#2E2C28] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1E1C1A]"
              >
                Cancel
              </button>
              <button 
                onClick={handleRecordPayment}
                disabled={paymentMut.isPending}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#1B7A4A] text-white font-bold hover:bg-[#155F3A] disabled:opacity-50"
              >
                {paymentMut.isPending ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#f8f9fa] dark:bg-[#1A1A1A] rounded-3xl p-6 border border-gray-200 dark:border-[#2E2C28] flex justify-center overflow-x-auto">
        <div className="origin-top" style={{ transform: 'scale(0.9)' }}>
          <InvoicePreview ref={previewRef} data={invoiceData} shop={shop || {}} />
        </div>
      </div>
    </div>
  )
}
