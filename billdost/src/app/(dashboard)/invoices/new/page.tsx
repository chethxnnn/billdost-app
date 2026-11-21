'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

import { InvoiceForm, invoiceFormSchema, InvoiceFormValues } from '@/components/invoices/InvoiceForm'
import { InvoicePreview, InvoicePreviewRef, InvoicePreviewData } from '@/components/invoices/InvoicePreview'
import { QuickAddGrid } from '@/components/invoices/QuickAddGrid'
import { computeTotals, derivePaymentStatus, stateCodeFromGstin } from '@/lib/money'
import { stateCodeForName } from '@/lib/indian-states'
import { saveActivitySnapshot } from '@/lib/activity-snapshot'

export default function NewInvoicePage() {
  const router = useRouter()
  const previewRef = useRef<InvoicePreviewRef>(null)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [rightPanel, setRightPanel] = useState<'products' | 'preview'>('products')

  // tRPC Setup
  const utils = trpc.useUtils()
  const { data: initialData } = trpc.invoices.getNextNumber.useQuery()
  const { data: realShop } = trpc.invoices.getShopSettings.useQuery()
  const createMut = trpc.invoices.create.useMutation()
  
  // Form Setup
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema) as any,
    defaultValues: {
      customer_name: '',
      invoice_date: new Date().toISOString().split('T')[0],
      items: [{ name: '', quantity: 1, unit_price: 0, tax_rate: 0 }],
      discount_pct: 0,
      payment_status: 'unpaid',
      amount_paid: 0,
      include_upi_qr: true,
      notes: '',
    }
  })

  const { watch, handleSubmit, setValue, getValues } = form

  const handleQuickAddProduct = (product: any) => {
    const currentItems = getValues('items') || []
    const existingIndex = currentItems.findIndex(i => i.name === product.name)

    if (existingIndex >= 0) {
      // Increment quantity (totals are derived, nothing else to update)
      const newQty = (currentItems[existingIndex].quantity || 0) + 1
      setValue(`items.${existingIndex}.quantity`, newQty)
      toast.success(`Increased ${product.name} quantity to ${newQty}`)
    } else {
      // Append or replace empty first item
      const isFirstEmpty = currentItems.length === 1 && !currentItems[0].name.trim()

      const newItem = {
        name: product.name,
        quantity: 1,
        unit_price: Number(product.price),
        tax_rate: Number(product.tax_rate || 0),
        product_id: product.id,
        unit: 'piece',
        discount_pct: 0
      }

      if (isFirstEmpty) {
        setValue('items.0', newItem)
      } else {
        setValue('items', [...currentItems, newItem])
      }
      toast.success(`Added ${product.name} to invoice`)
    }
  }

  // All money comes from the one engine in src/lib/money.ts, the same
  // code the server recomputes with. No second implementation here.
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

  const { subtotal, discount_amt, cgst_amt, sgst_amt, igst_amt, total } = totals

  const amountPaidNow =
    values.payment_status === 'paid' ? total : values.payment_status === 'partial' ? (values.amount_paid || 0) : 0
  const balance_due = Math.max(0, Math.round((total - amountPaidNow) * 100) / 100)

  useEffect(() => {
    if (values.payment_status === 'paid' && values.amount_paid !== total) {
      setValue('amount_paid', total)
    }
  }, [values.payment_status, total, values.amount_paid, setValue])

  // --- Auto-Save Draft Logic ---
  useEffect(() => {
    const saved = localStorage.getItem('invoice_draft')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        form.reset(parsed)
        toast('Draft restored', { description: 'Your previous unsaved invoice was recovered.' })
      } catch (e) {}
    }
  }, [form])

  useEffect(() => {
    const subscription = watch((val) => {
      // Don't save if it's completely empty and pristine
      if (val.customer_name || (val.items && val.items.length > 0 && val.items[0]?.name)) {
        localStorage.setItem('invoice_draft', JSON.stringify(val))
      }
    })
    return () => subscription.unsubscribe()
  }, [watch])
  // -----------------------------

  const previewData: InvoicePreviewData = {
    customer_name: values.customer_name || 'Customer Name',
    customer_phone: values.customer_phone,
    customer_address: values.customer_address,
    invoice_number: initialData?.invoiceNumber || 'INV-XXXX',
    invoice_date: values.invoice_date || new Date().toISOString(),
    due_date: values.due_date,
    items: (values.items || []).map((item, idx) => ({
      name: item.name,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      making_charge: item.making_charge,
      tax_rate: item.tax_rate || 0,
      tax_amt: totals.lines[idx]?.tax_amt || 0,
      total: totals.lines[idx]?.total || 0,
    })),
    subtotal,
    discount_pct: values.discount_pct || 0,
    discount_amt,
    cgst_amt,
    sgst_amt,
    igst_amt,
    total,
    amount_paid: amountPaidNow,
    balance_due,
    payment_status: derivePaymentStatus(amountPaidNow, total),
    include_upi_qr: values.include_upi_qr ?? true,
    notes: values.notes,
  }

  const shopData = {
    name: realShop?.name || 'Apni Dukaan',
    address: realShop?.address || '123 Market Road\nCity, State 123456',
    phone: realShop?.phone || '9876543210',
    gstin: realShop?.gstin || '',
    upi_id: realShop?.upi_id || 'merchant@upi',
    logo_url: (realShop as any)?.logo_url || '',
    terms_conditions: (realShop as any)?.terms_conditions || ''
  }

  const onSubmit = async (data: InvoiceFormValues) => {
    try {
      // Facts only: the server recomputes all totals with money.ts and
      // derives payment_status from amount_paid_at_creation.
      const payload = {
        customer_id: data.customer_id || null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || null,
        customer_address: data.customer_address || null,
        customer_gstin: data.customer_gstin || null,
        customer_state_code: data.customer_state_code || null,
        invoice_date: data.invoice_date,
        due_date: data.due_date || null,
        discount_pct: data.discount_pct || 0,
        amount_paid_at_creation:
          data.payment_status === 'paid' ? total : data.payment_status === 'partial' ? (data.amount_paid || 0) : 0,
        payment_mode: data.payment_mode || null,
        include_upi_qr: data.include_upi_qr ?? true,
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
      localStorage.removeItem('invoice_draft') // Clear draft on success
      // Keep the error-page recap fresh with the bill just made.
      saveActivitySnapshot({
        lastInvoiceNumber: result.invoice_number,
        lastCustomerName: data.customer_name,
      })
      toast.success(`Bill ${result.invoice_number} ban gaya! Ab WhatsApp par bhejo.`)
      // SAVE AND SEND flow: land on the bill itself, where WhatsApp send
      // is the primary action. The old flow dumped the user on the list.
      router.push(`/invoices/${result.id}`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDownload = async () => {
    if (previewRef.current) {
      await previewRef.current.downloadPDF()
    }
  }

  const handleFetchQuotation = async () => {
    const inputEl = document.getElementById('quotation-fetch-input') as HTMLInputElement
    const val = inputEl?.value?.trim()
    if (!val) return
    try {
      const qt = await utils.quotations.getByNumber.fetch({ quotation_number: val })
      
      // Auto-fill
      setValue('customer_name', qt.customer_name)
      if (qt.customer_phone) setValue('customer_phone', qt.customer_phone)
      if (qt.discount_pct) setValue('discount_pct', qt.discount_pct)
      
      const mappedItems = qt.items.map((it: any) => ({
        product_id: it.product_id,
        name: it.name,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        tax_rate: Number(it.tax_rate || 0),
      }))
      
      setValue('items', mappedItems)
      toast.success(`Quotation ${val} loaded!`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
      
      {/* --- Left Side: Form --- */}
      <div className="flex-1 overflow-y-auto pr-2 pb-24 lg:pb-0">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Naya Bill Banao 🧾
            </h1>
            <p className="text-sm text-gray-400 dark:text-[#98989D] mt-0.5">
              Invoice #{initialData?.invoiceNumber || '...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl overflow-hidden focus-within:border-[#1B7A4A] transition-colors">
              <input
                type="text"
                placeholder="Quotation No. (eg. QT-101)"
                id="quotation-fetch-input"
                className="w-48 px-3 py-2 text-xs bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={handleFetchQuotation}
                className="bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-white px-3 py-2 text-xs font-bold hover:bg-gray-200 dark:hover:bg-[#38383A] transition-colors"
              >
                Fetch
              </button>
            </div>
            <button 
              className="lg:hidden text-[#1B7A4A] font-semibold text-sm"
              onClick={() => setMobilePreviewOpen(true)}
            >
              Preview
            </button>
          </div>
        </div>

        <form id="invoice-form" onSubmit={handleSubmit(onSubmit)}>
          <InvoiceForm form={form} />
        </form>

        {/* Sticky action bar: the total is always visible while filling
            the bill, and the primary action says what it does. The old
            button promised printing it never did and landed nowhere
            useful. Saving now lands on the bill, where WhatsApp send
            is the primary action. */}
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
            type="submit" form="invoice-form"
            disabled={createMut.isPending}
            className="tap flex-1 px-6 py-3 min-h-[48px] rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-50 text-white font-black shadow-lg shadow-[#1B7A4A]/20 transition-all"
          >
            {createMut.isPending ? 'Save ho raha hai...' : `Bill Save Karo · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          </button>
        </div>
      </div>

      {/* --- Right Side: Split Panel (Desktop) --- */}
      <div className="hidden lg:block w-[45%] h-full sticky top-4">
        <div className="bg-[#F5F5F7] dark:bg-[#1C1C1E] rounded-3xl h-[calc(100vh-4rem)] flex flex-col border border-gray-200 dark:border-[#38383A] overflow-hidden">
          
          {/* Toggle Header */}
          <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E]">
            <div className="flex bg-gray-100 dark:bg-[#2C2C2E] rounded-lg p-1">
              <button
                onClick={() => setRightPanel('products')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${rightPanel === 'products' ? 'bg-white dark:bg-[#1C1C1E] text-[#1B7A4A] dark:text-[#25D366] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Products
              </button>
              <button
                onClick={() => setRightPanel('preview')}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${rightPanel === 'preview' ? 'bg-white dark:bg-[#1C1C1E] text-[#1B7A4A] dark:text-[#25D366] shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Live Preview
              </button>
            </div>
            {rightPanel === 'preview' && (
              <button 
                onClick={handleDownload}
                className="text-xs font-bold bg-white dark:bg-[#2C2C2E] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#48484A] text-gray-700 dark:text-gray-300 hover:text-[#1B7A4A] mr-2"
              >
                ⬇ Download PDF
              </button>
            )}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {rightPanel === 'products' ? (
              <QuickAddGrid onAddProduct={handleQuickAddProduct} />
            ) : (
              <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-[#1C1C1E]">
                <div className="w-full">
                   <InvoicePreview ref={previewRef} data={previewData} shop={shopData} />
                </div>
              </div>
            )}
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
              <InvoicePreview ref={previewRef} data={previewData} shop={shopData} />
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-[#1C1C1E] border-t border-gray-200 dark:border-[#38383A]">
            <button 
              onClick={handleDownload}
              className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold"
            >
              Download PDF
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
