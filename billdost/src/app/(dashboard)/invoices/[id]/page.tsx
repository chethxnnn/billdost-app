'use client'

import { useRef, use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { InvoicePreview, InvoicePreviewRef } from '@/components/invoices/InvoicePreview'
import { normalizePhone } from '@/lib/phone'
import { PaymentStatusBadge } from '@/components/invoices/PaymentStatusBadge'
import { ErrorFallback } from '@/components/shared/ErrorFallback'
import { useShop } from '@/components/shared/ShopContext'

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { id } = use(params)
  const { role } = useShop()
  const previewRef = useRef<InvoicePreviewRef>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const { data: invoiceData, isLoading, error, refetch } = trpc.invoices.get.useQuery(
    { id },
    { enabled: !!id }
  )
  const paymentMut = trpc.invoices.recordPayment.useMutation()
  const whatsappMut = trpc.whatsapp.sendInvoice.useMutation()
  const cancelMut = trpc.invoices.cancel.useMutation()

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading...</div>
  if (error || !invoiceData) {
    // No raw error surface: the shared calm fallback with recap + retry.
    return (
      <ErrorFallback
        error={error ? new Error(error.message) : new Error('Invoice not found')}
        onRetry={() => void refetch()}
        variant="inline"
      />
    )
  }

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

    // 1. Official WhatsApp Cloud API, server-side (trpc.whatsapp).
    // No fake success: if the API is not connected or Meta rejects,
    // the error is shown and we fall through to the share options.
    try {
      toast.loading("WhatsApp par bill bhej rahe hain...", { id: 'wa-send' })
      const pdfBase64 = previewRef.current ? await previewRef.current.getPDFBase64() : null
      await whatsappMut.mutateAsync({ invoiceId: id, pdfBase64: pdfBase64 || undefined })
      toast.success("WhatsApp bill customer ko bhej diya!", { id: 'wa-send' })
      return
    } catch (err: any) {
      toast.dismiss('wa-send')
      toast.warning(err.message || 'WhatsApp API se bill nahi bheja gaya.', { duration: 5000 })
    }

    // 2. Fallback to Native File Share (Mobile)
    if (previewRef.current) {
      toast.loading("Preparing PDF to share...", { id: 'share' })
      const shared = await previewRef.current.sharePDF(message)
      toast.dismiss('share')
      if (shared) return // Native share succeeded, no need for wa.me fallback
    }

    // 3. Ultimate Fallback: wa.me link with a properly normalised number
    const normalized = normalizePhone(invoice.customer_phone)
    if (!normalized) {
      toast.error("Customer ka phone number sahi nahi hai!")
      return
    }
    toast.info("WhatsApp Web khol rahe hain...")
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
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
  const isCancelled = Boolean((invoice as any).is_cancelled)
  const canCancel = role !== 'cashier' && !isCancelled

  const handleCancelInvoice = async () => {
    try {
      await cancelMut.mutateAsync({ id })
      toast.success('Bill cancel ho gaya. Stock wapas jud gaya hai.')
      setConfirmingCancel(false)
      utils.invoices.get.invalidate({ id })
      utils.invoices.list.invalidate()
    } catch (err: any) {
      toast.error(err.message || 'Bill cancel nahi hua.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {isCancelled && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-2xl px-5 py-4 text-sm font-bold">
          Ye bill cancel ho chuka hai. Stock aur hisaab iske hisaab se adjust ho gaya hai.
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/invoices" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">← Back</Link>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
            Invoice {invoice.invoice_number}
          </h1>
          {/* One shared tri-state badge: a partial bill is Partial here too, not Unpaid. */}
          <PaymentStatusBadge status={invoice.payment_status} balanceDue={invoice.balance_due} />
        </div>

        <div className="flex gap-2 flex-wrap">
          {!isPaid && !isCancelled && !showPaymentForm && (
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
          {!isCancelled && (
            <button
              onClick={handleWhatsApp}
              className="tap bg-[#25D366]/10 text-[#1B7A4A] dark:text-[#25D366] px-4 py-2 min-h-[44px] rounded-xl font-bold hover:bg-[#25D366]/20 transition-colors"
            >
              Send WhatsApp
            </button>
          )}
          <button
            onClick={handleDownload}
            className="tap bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] px-4 py-2 min-h-[44px] rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
          >
            Download PDF
          </button>
          {!isCancelled && (
            <a
              href={`/print/invoice/${id}`}
              target="_blank"
              rel="noreferrer"
              className="tap inline-flex items-center bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] px-4 py-2 min-h-[44px] rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
            >
              Thermal Print
            </a>
          )}
          {/* Cancel action (was API-only before Stage 3): manager/owner, two-step confirm */}
          {canCancel && !confirmingCancel && (
            <button
              onClick={() => setConfirmingCancel(true)}
              className="tap px-4 py-2 min-h-[44px] rounded-xl font-bold text-[#FF3B30] dark:text-[#FF453A] border border-[#FF3B30]/30 hover:bg-[#FF3B30]/10 transition-colors"
            >
              Bill Cancel Karo
            </button>
          )}
          {canCancel && confirmingCancel && (
            <span className="inline-flex items-center gap-2">
              <span className="text-sm font-bold text-[#FF3B30] dark:text-[#FF453A]">Pakka cancel karein?</span>
              <button
                onClick={handleCancelInvoice}
                disabled={cancelMut.isPending}
                className="tap px-4 py-2 min-h-[44px] rounded-xl bg-[#FF3B30] text-white font-bold disabled:opacity-50"
              >
                {cancelMut.isPending ? 'Ho raha hai...' : 'Haan, Cancel'}
              </button>
              <button
                onClick={() => setConfirmingCancel(false)}
                className="tap px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 dark:border-[#38383A] font-bold"
              >
                Nahi
              </button>
            </span>
          )}
        </div>
      </div>

      {showPaymentForm && (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase mb-4">Record New Payment</h3>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="payment-amount" className="block text-xs font-semibold text-gray-500 mb-1.5">Amount Received (Max: ₹{invoice.balance_due})</label>
              <input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="payment-mode" className="block text-xs font-semibold text-gray-500 mb-1.5">Payment Mode</label>
              <select
                id="payment-mode"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
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
                className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-[#38383A] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
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

      <div className="bg-[#F5F5F7] dark:bg-[#1C1C1E] rounded-3xl p-6 border border-gray-200 dark:border-[#38383A] flex justify-center overflow-x-auto">
        <div className="w-full">
          <InvoicePreview ref={previewRef} data={invoiceData} shop={shop || {}} />
        </div>
      </div>
    </div>
  )
}
