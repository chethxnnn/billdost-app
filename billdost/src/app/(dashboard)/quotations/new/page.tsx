'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

import { QuotationForm, quotationFormSchema, QuotationFormValues } from '@/components/quotations/QuotationForm'
import { QuotationPreview, QuotationPreviewRef, QuotationPreviewData } from '@/components/quotations/QuotationPreview'
import { computeTotals, stateCodeFromGstin } from '@/lib/money'
import { stateCodeForName } from '@/lib/indian-states'
import { normalizePhone } from '@/lib/phone'

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
      items: [{ name: '', quantity: 1, unit_price: 0, tax_rate: 0 }],
      discount_pct: 0,
      notes: '',
    }
  })

  const { watch, handleSubmit } = form

  // All money comes from the one engine in src/lib/money.ts, the same
  // code the server recomputes with.
  const values = watch()

  const totals = computeTotals({
    items: (values.items || []).map((item) => ({
      name: item.name,
      hsn_code: item.hsn_code,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      making_charge: item.making_charge,
      tax_rate: item.tax_rate || 0,
      discount_pct: item.discount_pct || 0,
    })),
    discount_pct: values.discount_pct || 0,
    shop_state_code:
      stateCodeForName((realShop as any)?.state) || stateCodeFromGstin(realShop?.gstin),
    customer_state_code: values.customer_state_code,
    customer_gstin: values.customer_gstin,
    is_gst_registered: Boolean(realShop?.gstin),
    round_off: true,
  })

  const { subtotal, discount_amt, total } = totals

  // Prepare data for Preview Component
  const previewData: QuotationPreviewData = {
    customer_name: values.customer_name || 'Customer Name',
    customer_phone: values.customer_phone,
    customer_address: values.customer_address,
    quotation_number: initialData?.quotationNumber || 'QT-XXXX',
    quotation_date: new Date().toISOString(),
    valid_until: values.valid_until,
    items: (values.items || []).map((item, idx) => ({
      name: item.name,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      total: totals.lines[idx]?.total || 0,
    })),
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
    gstin: (realShop as any)?.gstin || '',
    logo_url: (realShop as any)?.logo_url || '',
    terms_conditions: (realShop as any)?.terms_conditions || '',
  }

  const onSubmit = async (data: QuotationFormValues) => {
    try {
      // Facts only: the server recomputes all totals with money.ts.
      const payload = {
        customer_id: data.customer_id || null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || null,
        customer_address: data.customer_address || null,
        customer_gstin: data.customer_gstin || null,
        customer_state_code: data.customer_state_code || null,
        discount_pct: data.discount_pct || 0,
        valid_until: data.valid_until || null,
        notes: data.notes || null,
        items: (data.items || []).map((item) => ({
          product_id: item.product_id || null,
          name: item.name,
          hsn_code: item.hsn_code || null,
          unit: item.unit || 'piece',
          quantity: item.quantity,
          unit_price: item.unit_price,
          making_charge: item.making_charge || 0,
          tax_rate: item.tax_rate || 0,
          discount_pct: item.discount_pct || 0,
        })),
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
    const normalized = normalizePhone(values.customer_phone)
    if (!normalized) {
      toast.error("Customer ka phone number sahi nahi hai!")
      return
    }
    const message = `Hello ${values.customer_name},\n\nAapka estimate (No: ${initialData?.quotationNumber}) ₹${total.toFixed(2)} ka ready hai.\n\nRegards,\n${shopData.name}`
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
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
            <p className="text-sm text-gray-400 dark:text-[#98989D] mt-0.5">
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

        {/* Sticky action bar with the total always visible, same as the invoice form. */}
        <div className="sticky bottom-0 z-20 mt-8 -mx-2 px-2 py-3 bg-[#F5F5F7]/90 dark:bg-black/70 backdrop-blur-xl border-t border-gray-200 dark:border-[#38383A] flex items-center gap-3">
          <div className="hidden sm:block">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#98989D]">Total</div>
            <div className="text-lg font-black text-gray-900 dark:text-white leading-none">
              ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="tap px-5 py-3 min-h-[48px] rounded-xl border border-gray-200 dark:border-[#38383A] font-bold text-gray-600 dark:text-[#98989D] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit" form="quotation-form"
            disabled={createMut.isPending}
            className="tap flex-1 px-6 py-3 min-h-[48px] rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-50 text-white font-black shadow-lg shadow-[#1B7A4A]/20 transition-all"
          >
            {createMut.isPending ? 'Save ho raha hai...' : `Estimate Save Karo · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          </button>
        </div>
      </div>

      {/* --- Right Side: Live Preview (Desktop) --- */}
      <div className="hidden lg:block w-[45%] h-full sticky top-4">
        <div className="bg-[#F5F5F7] dark:bg-[#1C1C1E] rounded-3xl p-6 h-[calc(100vh-4rem)] flex flex-col border border-gray-200 dark:border-[#38383A]">
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
                className="text-xs font-bold bg-white dark:bg-[#2C2C2E] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#48484A] text-gray-700 dark:text-gray-300 hover:text-[#1B7A4A]"
              >
                ⬇ PDF
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto rounded-xl border border-gray-100 dark:border-none shadow-sm hide-scrollbar">
            <div className="w-full">
               <QuotationPreview ref={previewRef} data={previewData} shop={shopData} />
            </div>
          </div>
        </div>
      </div>

      {/* --- Mobile Preview Modal --- */}
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden flex flex-col">
          <div className="flex justify-between items-center p-4 bg-white dark:bg-[#1C1C1E]">
            <h2 className="font-bold text-gray-900 dark:text-white">Live Preview</h2>
            <button onClick={() => setMobilePreviewOpen(false)} className="text-gray-500 font-bold p-2">✕ Close</button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex justify-center">
            <div className="w-full max-w-[794px]">
              <QuotationPreview ref={previewRef} data={previewData} shop={shopData} />
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-[#1C1C1E] border-t border-gray-200 dark:border-[#38383A] flex gap-3">
             <button 
                onClick={handleWhatsApp}
                className="flex-1 py-3 bg-[#25D366]/10 text-[#25D366] font-bold rounded-xl"
              >
                Send via WhatsApp
              </button>
             <button 
                onClick={handleDownload}
                className="flex-1 py-3 bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white font-bold rounded-xl"
              >
                Download PDF
              </button>
          </div>
        </div>
      )}
    </div>
  )
}
