'use client'

import { useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { QuotationPreview, QuotationPreviewRef } from '@/components/quotations/QuotationPreview'

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const previewRef = useRef<QuotationPreviewRef>(null)

  const { data: quotation, isLoading, error } = trpc.quotations.getById.useQuery(
    { id },
    { enabled: !!id }
  )
  const { data: realShop } = trpc.quotations.getShopSettings.useQuery()
  const convertMut = trpc.quotations.convertToInvoice.useMutation()

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading...</div>
  if (error || !quotation) return <div className="p-8 text-center text-red-500">Error loading quotation</div>

  const shopData = {
    name: realShop?.name || 'Apni Dukaan',
    address: realShop?.address || '',
    phone: realShop?.phone || '',
  }

  const handleDownload = async () => {
    if (previewRef.current) await previewRef.current.downloadPDF()
  }

  const handleWhatsApp = () => {
    if (!quotation.customer_phone) {
      toast.error("Customer ka phone number nahi hai!")
      return
    }
    const message = `Hello ${quotation.customer_name},\n\nAapka estimate (No: ${quotation.quotation_number}) ₹${quotation.total} ka ready hai.\n\nRegards,\n${shopData.name}`
    const url = `https://wa.me/91${quotation.customer_phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/quotations" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">← Back</Link>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
            Quotation {quotation.quotation_number}
          </h1>
          {isConverted && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Converted</span>}
        </div>
        
        <div className="flex gap-2">
          {!isConverted && (
            <button 
              onClick={handleConvert}
              disabled={convertMut.isPending}
              className="bg-[#1B7A4A] text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-[#1B7A4A]/20 hover:bg-[#155F3A] transition-colors"
            >
              {convertMut.isPending ? 'Converting...' : 'Convert to Invoice'}
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

      <div className="bg-[#f8f9fa] dark:bg-[#1A1A1A] rounded-3xl p-6 border border-gray-200 dark:border-[#2E2C28] flex justify-center overflow-x-auto">
        <div className="origin-top" style={{ transform: 'scale(0.9)' }}>
          <QuotationPreview ref={previewRef} data={quotation} shop={shopData} />
        </div>
      </div>
    </div>
  )
}
