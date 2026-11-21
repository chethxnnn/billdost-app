'use client'

import { useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { QuotationPreview, QuotationPreviewRef } from '@/components/quotations/QuotationPreview'
import { QuotationStatusBadge } from '@/components/quotations/QuotationStatusBadge'
import { ErrorFallback } from '@/components/shared/ErrorFallback'
import { normalizePhone } from '@/lib/phone'

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { id } = use(params)
  const previewRef = useRef<QuotationPreviewRef>(null)

  const { data: quotation, isLoading, error, refetch } = trpc.quotations.getById.useQuery(
    { id },
    { enabled: !!id }
  )
  const { data: realShop } = trpc.quotations.getShopSettings.useQuery()
  const convertMut = trpc.quotations.convertToInvoice.useMutation()
  const statusMut = trpc.quotations.updateStatus.useMutation()
  const whatsappMut = trpc.whatsapp.sendQuotation.useMutation()

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading...</div>
  if (error || !quotation) {
    return (
      <ErrorFallback
        error={error ? new Error(error.message) : new Error('Quotation not found')}
        onRetry={() => void refetch()}
        variant="inline"
      />
    )
  }

  const shopData = {
    name: realShop?.name || 'Apni Dukaan',
    address: realShop?.address || '',
    phone: realShop?.phone || '',
    gstin: (realShop as any)?.gstin || '',
    logo_url: (realShop as any)?.logo_url || '',
    terms_conditions: (realShop as any)?.terms_conditions || '',
  }

  const handleDownload = async () => {
    if (previewRef.current) await previewRef.current.downloadPDF()
  }

  const handleWhatsApp = async () => {
    if (!quotation.customer_phone) {
      toast.error("Customer ka phone number nahi hai!")
      return
    }
    const message = `Hello ${quotation.customer_name},\n\nAapka estimate (No: ${quotation.quotation_number}) ₹${quotation.total} ka ready hai.\n\nRegards,\n${shopData.name}`

    // 1. Official WhatsApp Cloud API, server-side (trpc.whatsapp),
    // mirroring the invoice send. No fake success: on failure the
    // reason is shown and we fall through to the wa.me share link.
    try {
      toast.loading("WhatsApp par quotation bhej rahe hain...", { id: 'wa-send' })
      const pdfBase64 = previewRef.current ? await previewRef.current.getPDFBase64() : null
      await whatsappMut.mutateAsync({ quotationId: id, pdfBase64: pdfBase64 || undefined })
      toast.success("WhatsApp quotation customer ko bhej diya!", { id: 'wa-send' })
      utils.quotations.getById.invalidate({ id })
      utils.quotations.list.invalidate()
      return
    } catch (err: any) {
      toast.dismiss('wa-send')
      toast.warning(err.message || 'WhatsApp API se quotation nahi bheja gaya.', { duration: 5000 })
    }

    // 2. Honest fallback: wa.me share link with a normalised number.
    // normalizePhone handles numbers already carrying the 91 prefix;
    // the old code hard-prefixed 91 and produced 9191... links.
    const normalized = normalizePhone(quotation.customer_phone)
    if (!normalized) {
      toast.error("Customer ka phone number sahi nahi hai!")
      return
    }
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleStatus = async (status: 'sent' | 'accepted' | 'rejected') => {
    try {
      await statusMut.mutateAsync({ id, status })
      toast.success(
        status === 'sent'
          ? 'Quotation bheja hua mark ho gaya.'
          : status === 'accepted'
            ? 'Customer ne haan keh diya. Ab bill banao!'
            : 'Quotation rejected mark ho gaya.'
      )
      utils.quotations.getById.invalidate({ id })
      utils.quotations.list.invalidate()
    } catch (err: any) {
      toast.error(err.message || 'Status change nahi hua.')
    }
  }

  const handleConvert = () => {
    toast('Confirm Conversion', {
      description: 'Kya aap is estimate ko Pakka Bill banana chahte ho?',
      action: {
        label: 'Haan, Bill Banao',
        onClick: async () => {
          try {
            const newInvoice = await convertMut.mutateAsync({ id })
            toast.success('Bill ban gaya!')
            router.push(`/invoices/${newInvoice.invoice_id}`)
          } catch (err: any) {
            toast.error(err.message)
          }
        }
      },
      cancel: { label: 'Cancel', onClick: () => {} }
    })
  }

  const isConverted = quotation.status === 'converted'
  const qStatus = quotation.status as string
  const canMarkSent = qStatus === 'draft'
  const canMarkResponse = qStatus === 'draft' || qStatus === 'sent'

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/quotations" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">← Back</Link>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
            Quotation {quotation.quotation_number}
          </h1>
          {/* Status is now visible for every state, not only Converted. */}
          <QuotationStatusBadge status={qStatus} />
        </div>

        <div className="flex gap-2 flex-wrap">
          {canMarkSent && (
            <button
              onClick={() => handleStatus('sent')}
              disabled={statusMut.isPending}
              className="tap bg-blue-600 text-white px-4 py-2 min-h-[44px] rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Bheja Hua Mark Karo
            </button>
          )}
          {canMarkResponse && (
            <>
              <button
                onClick={() => handleStatus('accepted')}
                disabled={statusMut.isPending}
                className="tap bg-green-600 text-white px-4 py-2 min-h-[44px] rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Customer Ne Haan Kaha
              </button>
              <button
                onClick={() => handleStatus('rejected')}
                disabled={statusMut.isPending}
                className="tap px-4 py-2 min-h-[44px] rounded-xl font-bold text-[#FF3B30] dark:text-[#FF453A] border border-[#FF3B30]/30 hover:bg-[#FF3B30]/10 transition-colors disabled:opacity-50"
              >
                Mana Kar Diya
              </button>
            </>
          )}
          {!isConverted && (
            <button
              onClick={handleConvert}
              disabled={convertMut.isPending}
              className="tap bg-[#1B7A4A] text-white px-4 py-2 min-h-[44px] rounded-xl font-bold shadow-lg shadow-[#1B7A4A]/20 hover:bg-[#155F3A] transition-colors disabled:opacity-50"
            >
              {convertMut.isPending ? 'Converting...' : 'Convert to Invoice'}
            </button>
          )}
          <button
            onClick={handleWhatsApp}
            className="tap bg-[#25D366]/10 text-[#1B7A4A] dark:text-[#25D366] px-4 py-2 min-h-[44px] rounded-xl font-bold hover:bg-[#25D366]/20 transition-colors"
          >
            Send WhatsApp
          </button>
          <button
            onClick={handleDownload}
            className="tap bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] px-4 py-2 min-h-[44px] rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="bg-[#F5F5F7] dark:bg-[#1C1C1E] rounded-3xl p-6 border border-gray-200 dark:border-[#38383A] flex justify-center overflow-x-auto">
        <div className="w-full">
          <QuotationPreview ref={previewRef} data={{ ...quotation, quotation_date: quotation.created_at }} shop={shopData} />
        </div>
      </div>
    </div>
  )
}
