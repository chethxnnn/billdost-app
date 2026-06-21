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

export default function NewInvoicePage() {
  const router = useRouter()
  const previewRef = useRef<InvoicePreviewRef>(null)
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [rightPanel, setRightPanel] = useState<'products' | 'preview'>('products')

  // tRPC Setup
  const utils = trpc.useUtils ? trpc.useUtils() : (trpc as any).useContext()
  const { data: initialData } = trpc.invoices.getNextNumber.useQuery()
  const { data: realShop } = trpc.invoices.getShopSettings.useQuery()
  const createMut = trpc.invoices.create.useMutation()
  
  // Form Setup
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema) as any,
    defaultValues: {
      customer_name: '',
      invoice_date: new Date().toISOString().split('T')[0],
      items: [{ name: '', quantity: 1, unit_price: 0, tax_rate: 0, tax_amt: 0, total: 0 }],
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
      // Increment quantity
      const newQty = (currentItems[existingIndex].quantity || 0) + 1
      setValue(`items.${existingIndex}.quantity`, newQty)
      
      const price = currentItems[existingIndex].unit_price || 0
      const taxRate = currentItems[existingIndex].tax_rate || 0
      const baseTotal = newQty * price
      const taxAmt = baseTotal * (taxRate / 100)
      
      setValue(`items.${existingIndex}.tax_amt`, taxAmt)
      setValue(`items.${existingIndex}.total`, baseTotal + taxAmt)
      toast.success(`Increased ${product.name} quantity to ${newQty}`)
    } else {
      // Append or replace empty first item
      const isFirstEmpty = currentItems.length === 1 && !currentItems[0].name.trim()
      
      const qty = 1
      const price = Number(product.price)
      const taxRate = Number(product.tax_rate || 0)
      const baseTotal = qty * price
      const taxAmt = baseTotal * (taxRate / 100)
      
      const newItem = {
        name: product.name,
        quantity: qty,
        unit_price: price,
        tax_rate: taxRate,
        tax_amt: taxAmt,
        total: baseTotal + taxAmt,
        product_id: product.id
      }

      if (isFirstEmpty) {
        setValue('items.0', newItem)
      } else {
        setValue('items', [...currentItems, newItem])
      }
      toast.success(`Added ${product.name} to invoice`)
    }
  }

  // Compute derived values dynamically on render based on watched fields
  const values = watch()
  
  const subtotal = (values.items || []).reduce((acc, item) => acc + ((item.quantity || 0) * (item.unit_price || 0)) + (item.making_charge || 0), 0)
  const discount_amt = subtotal * ((values.discount_pct || 0) / 100)
  const postDiscount = subtotal - discount_amt
  
  const totalTax = (values.items || []).reduce((acc, item) => acc + (item.tax_amt || 0), 0)
  const cgst_amt = totalTax / 2
  const sgst_amt = totalTax / 2
  
  const total = postDiscount + totalTax
  
  let balance_due = total
  if (values.payment_status === 'paid') {
    balance_due = 0
  } else if (values.payment_status === 'partial') {
    balance_due = total - (values.amount_paid || 0)
  }

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
    items: values.items || [],
    subtotal,
    discount_pct: values.discount_pct || 0,
    discount_amt,
    cgst_amt,
    sgst_amt,
    total,
    amount_paid: values.payment_status === 'paid' ? total : (values.amount_paid || 0),
    balance_due,
    payment_status: values.payment_status || 'unpaid',
    include_upi_qr: values.include_upi_qr ?? true,
    notes: values.notes,
  }

  const shopData = {
    name: realShop?.name || 'Apni Dukaan',
    address: realShop?.address || '123 Market Road\nCity, State 123456',
    phone: realShop?.phone || '9876543210',
    gstin: realShop?.gstin || '',
    upi_id: realShop?.upi_id || 'merchant@upi'
  }

  const onSubmit = async (data: InvoiceFormValues) => {
    try {
      const payload = {
        ...data,
        subtotal,
        discount_amt,
        taxable_amt: postDiscount,
        cgst_amt,
        sgst_amt,
        igst_amt: 0,
        total,
        balance_due,
      }
      
      const result = await createMut.mutateAsync(payload)
      localStorage.removeItem('invoice_draft') // Clear draft on success
      toast.success(`Invoice ${result.invoice_number} created successfully!`)
      router.push('/invoices')
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
        quantity: it.quantity,
        unit_price: it.unit_price,
        tax_rate: 0,
        tax_amt: 0,
        total: it.total,
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
            <p className="text-sm text-gray-400 dark:text-[#5C5A56] mt-0.5">
              Invoice #{initialData?.invoiceNumber || '...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-xl overflow-hidden focus-within:border-[#1B7A4A] transition-colors">
              <input
                type="text"
                placeholder="Quotation No. (eg. QT-101)"
                id="quotation-fetch-input"
                className="w-48 px-3 py-2 text-xs bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={handleFetchQuotation}
                className="bg-gray-100 dark:bg-[#252320] text-gray-700 dark:text-white px-3 py-2 text-xs font-bold hover:bg-gray-200 dark:hover:bg-[#2E2C28] transition-colors"
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

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-[#2E2C28] flex gap-4">
          <button 
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl border border-gray-200 dark:border-[#2E2C28] font-bold text-gray-600 dark:text-[#9A9690] hover:bg-gray-50 dark:hover:bg-[#1E1C1A] transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" form="invoice-form"
            disabled={createMut.isPending}
            className="flex-1 px-6 py-3 rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-50 text-white font-black shadow-lg shadow-[#1B7A4A]/20 transition-all"
          >
            {createMut.isPending ? 'Saving...' : 'Save & Print Invoice'}
          </button>
        </div>
      </div>

      {/* --- Right Side: Split Panel (Desktop) --- */}
      <div className="hidden lg:block w-[45%] h-full sticky top-4">
        <div className="bg-[#f8f9fa] dark:bg-[#1A1A1A] rounded-3xl h-[calc(100vh-4rem)] flex flex-col border border-gray-200 dark:border-[#2E2C28] overflow-hidden">
          
          {/* Toggle Header */}
          <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-[#2E2C28] bg-white dark:bg-[#1C1C1E]">
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
                className="text-xs font-bold bg-white dark:bg-[#252320] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#3E3C38] text-gray-700 dark:text-gray-300 hover:text-[#1B7A4A] mr-2"
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
              <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-[#1A1A1A]">
                <div className="origin-top" style={{ transform: 'scale(0.8)', width: '125%' }}>
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
          <div className="flex justify-between items-center p-4 bg-white dark:bg-[#161513]">
            <h2 className="font-bold text-gray-900 dark:text-white">Live Preview</h2>
            <button onClick={() => setMobilePreviewOpen(false)} className="text-gray-500 font-bold p-2">✕ Close</button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex justify-center">
            <div className="origin-top transform scale-[0.6] sm:scale-75 w-[166%]">
              <InvoicePreview ref={previewRef} data={previewData} shop={shopData} />
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-[#161513] border-t border-gray-200 dark:border-[#2E2C28]">
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
