'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

import { QuotationForm, quotationFormSchema, QuotationFormValues } from '@/components/quotations/QuotationForm'
import { QuotationPreview, QuotationPreviewRef, QuotationPreviewData } from '@/components/quotations/QuotationPreview'

export default function NewQuotationPage() {
  const router = useRouter()
  const previewRef = useRef<QuotationPreviewRef>(null)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)

  // tRPC Setup
  const { data: initialData } = trpc.quotations.getNextNumber.useQuery()
  const { data: realShop } = trpc.quotations.getShopSettings.useQuery()
  const createMut = trpc.quotations.create.useMutation()
  
  // Form Setup
  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationFormSchema) as any,
    defaultValues: {
      customer_name: '',
      items: [{ name: '', quantity: 1, unit_price: 0, total: 0 }],
      discount_pct: 0,
      notes: '',
    }
  })

  const { watch, handleSubmit } = form

  // Compute derived values
  const values = watch()
  
  const subtotal = (values.items || []).reduce((acc, item) => acc + ((item.quantity || 0) * (item.unit_price || 0)), 0)
  const discount_amt = subtotal * ((values.discount_pct || 0) / 100)
  const total = subtotal - discount_amt
  
  // Prepare data for Preview Component
  const previewData: QuotationPreviewData = {
    customer_name: values.customer_name || 'Customer Name',
    customer_phone: values.customer_phone,
    customer_address: values.customer_address,
    quotation_number: initialData?.quotationNumber || 'QT-XXXX',
    valid_until: values.valid_until,
    items: values.items || [],
    subtotal,
    discount_pct: values.discount_pct || 0,
    discount_amt,
    total,
    notes: values.notes,
  }

  // Shop placeholder
  const shopData = {
    name: realShop?.name || 'Apni Dukaan',
    address: realShop?.address || '123 Market Road\nCity, State 123456',
    phone: realShop?.phone || '9876543210',
  }

  const onSubmit = async (data: QuotationFormValues) => {
    try {
      const payload = {
        ...data,
        subtotal,
        discount_amt,
        tax_amt: 0,
        total,
      }
      
      const result = await createMut.mutateAsync(payload)
      toast.success(`Quotation ${result.quotation_number} created successfully!`)
      router.push(`/quotations/${result.id}`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDownload = async () => {
    if (previewRef.current) {
      await previewRef.current.downloadPDF()
    }
  }

  // WhatsApp Sending
  const handleWhatsApp = () => {
    if (!values.customer_phone) {
      toast.error("Customer ka phone number zaroori hai WhatsApp ke liye!")
      return
    }
    const message = `Hello ${values.customer_name},\n\nAapka estimate (No: ${initialData?.quotationNumber}) ₹${total.toFixed(2)} ka ready hai.\n\nRegards,\n${shopData.name}`
    const url = `https://wa.me/91${values.customer_phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
      
      {/* --- Left Side: Form --- */}
      <div className="flex-1 overflow-y-auto pr-2 pb-24 lg:pb-0">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Naya Quotation Banao 📄
            </h1>
            <p className="text-sm text-gray-400 dark:text-[#5C5A56] mt-0.5">
              Estimate #{initialData?.quotationNumber || '...'}
            </p>
          </div>
          <button 
            className="lg:hidden text-[#1B7A4A] font-semibold text-sm"
            onClick={() => setMobilePreviewOpen(true)}
          >
            Preview Dekho
          </button>
        </div>

        <form id="quotation-form" onSubmit={handleSubmit(onSubmit)}>
          <QuotationForm form={form} />
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-[#2E2C28] flex gap-4">
          <button 
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl border border-gray-200 dark:border-[#2E2C28] font-bold text-gray-600 dark:text-[#9A9690] hover:bg-gray-50 dark:hover:bg-[#1E1C1A] transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" form="quotation-form"
            disabled={createMut.isPending}
            className="flex-1 px-6 py-3 rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-50 text-white font-black shadow-lg shadow-[#1B7A4A]/20 transition-all"
          >
            {createMut.isPending ? 'Saving...' : 'Save Estimate'}
          </button>
        </div>
      </div>

      {/* --- Right Side: Live Preview (Desktop) --- */}
      <div className="hidden lg:block w-[45%] h-full sticky top-4">
        <div className="bg-[#f8f9fa] dark:bg-[#1A1A1A] rounded-3xl p-6 h-[calc(100vh-4rem)] flex flex-col border border-gray-200 dark:border-[#2E2C28]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white">Live Preview</h2>
            <div className="flex gap-2">
              <button 
                onClick={handleWhatsApp}
                className="text-xs font-bold bg-[#25D366]/10 text-[#25D366] px-3 py-1.5 rounded-lg hover:bg-[#25D366]/20 transition-colors flex items-center gap-1"
              >
                Send WA
              </button>
              <button 
                onClick={handleDownload}
                className="text-xs font-bold bg-white dark:bg-[#252320] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#3E3C38] text-gray-700 dark:text-gray-300 hover:text-[#1B7A4A]"
              >
                ⬇ PDF
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto rounded-xl border border-gray-100 dark:border-none shadow-sm hide-scrollbar">
            <div className="origin-top" style={{ transform: 'scale(0.8)', width: '125%' }}>
               <QuotationPreview ref={previewRef} data={previewData} shop={shopData} />
            </div>
          </div>
        </div>
      </div>

      {/* --- Mobile Preview Modal --- */}
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden flex flex-col">
          <div className="flex justify-between items-center p-4 bg-white dark:bg-[#161513]">
            <h2 className="font-bold text-gray-900 dark:text-white">Live Preview</h2>
            <button onClick={() => setMobilePreviewOpen(false)} className="text-gray-500 font-bold p-2">✕ Close</button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex justify-center">
            <div className="origin-top transform scale-[0.6] sm:scale-75 w-[166%]">
              <QuotationPreview ref={previewRef} data={previewData} shop={shopData} />
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-[#161513] border-t border-gray-200 dark:border-[#2E2C28] flex gap-3">
             <button 
                onClick={handleWhatsApp}
                className="flex-1 py-3 bg-[#25D366]/10 text-[#25D366] font-bold rounded-xl"
              >
                Send via WhatsApp
              </button>
             <button 
                onClick={handleDownload}
                className="flex-1 py-3 bg-gray-100 dark:bg-[#252320] text-gray-900 dark:text-white font-bold rounded-xl"
              >
                Download PDF
              </button>
          </div>
        </div>
      )}
    </div>
  )
}
