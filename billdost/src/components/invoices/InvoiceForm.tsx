'use client'

import { useFieldArray, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'
import { useShop } from '@/components/shared/ShopContext'
import { ALLOWED_TAX_RATES, computeTotals, stateCodeFromGstin } from '@/lib/money'
import { INDIAN_STATES, stateCodeForName } from '@/lib/indian-states'
import { QuickAddGrid } from '@/components/invoices/QuickAddGrid'
import { BarcodeScanner } from '@/components/shared/BarcodeScanner'
import { ChevronDown, ScanLine } from 'lucide-react'
import { toast } from 'sonner'

/* ─── Schema ───
   Facts only: line totals are never stored on the form. Every total in
   the UI and on the server comes from src/lib/money.ts computeTotals. */
export const invoiceFormSchema = z.object({
  customer_name: z.string().min(1, 'Naam likhna zaroori hai'),
  customer_phone: z.string().max(10, 'Phone number 10 digits se lamba nahi ho sakta').optional().nullable(),
  customer_address: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  customer_gstin: z.string().max(15).optional().nullable(),
  customer_state_code: z.string().optional().nullable(),

  invoice_date: z.string(),
  due_date: z.string().optional().nullable(),

  items: z.array(
    z.object({
      product_id: z.string().optional().nullable(),
      name: z.string().min(1, 'Item ka naam likho'),
      hsn_code: z.string().optional().nullable(),
      unit: z.string().default('piece'),
      quantity: z.number().min(0.01),
      unit_price: z.number().min(0),
      making_charge: z.number().optional().nullable(),
      tax_rate: z.number().default(0),
      discount_pct: z.number().min(0).max(100).default(0),
    })
  ).min(1, 'Kam se kam ek item add karo'),

  discount_pct: z.number().min(0).max(100).default(0),
  
  // Payment
  payment_status: z.enum(['unpaid', 'partial', 'paid']).default('unpaid'),
  payment_mode: z.string().optional().nullable(),
  amount_paid: z.number().min(0).default(0),
  include_upi_qr: z.boolean().default(true),
  
  notes: z.string().optional().nullable(),
})

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>

/* ─── Components ─── */
export function InvoiceForm({ form }: { form: UseFormReturn<InvoiceFormValues> }) {
  const { register, control, watch, setValue, formState: { errors } } = form
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  })

  // Watch for dependent values
  const items = watch('items')
  const discountPct = watch('discount_pct')
  const paymentStatus = watch('payment_status')
  const customerGstin = watch('customer_gstin')
  const customerStateCode = watch('customer_state_code')

  const { shopCategory } = useShop()
  const isJewellery = shopCategory === 'jewellery'

  // Queries
  const { data: customers } = trpc.customers.list.useQuery()
  const { data: products } = trpc.products.list.useQuery()
  const { data: shopSettings } = trpc.invoices.getShopSettings.useQuery()

  // Live totals from the one money engine (same code the server runs).
  const totals = computeTotals({
    items: (items || []).map((item) => ({
      name: item.name,
      hsn_code: item.hsn_code,
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
      making_charge: item.making_charge,
      tax_rate: item.tax_rate || 0,
      discount_pct: item.discount_pct || 0,
    })),
    discount_pct: discountPct || 0,
    shop_state_code:
      stateCodeForName((shopSettings as any)?.state) ||
      stateCodeFromGstin(shopSettings?.gstin),
    customer_state_code: customerStateCode,
    customer_gstin: customerGstin,
    is_gst_registered: Boolean(shopSettings?.gstin),
    round_off: true,
  })

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const trpcUtils = trpc.useUtils()

  // Barcode scan-to-add (blueprint D2): the scanned code resolves to a
  // catalog product through products.getByBarcode and then flows
  // through the exact same add path as a QuickAdd tap, so repeat scans
  // increment quantity. Unknown codes say so honestly and point at the
  // catalog instead of silently doing nothing.
  const handleBarcode = async (code: string) => {
    setScannerOpen(false)
    try {
      const product = await trpcUtils.products.getByBarcode.fetch({ barcode: code })
      if (product) {
        handleQuickAddProduct(product as any)
        toast.success(`${product.name} add ho gaya`)
      } else {
        toast.error(`Barcode ${code} kisi product par nahi hai. Catalog mein is code ke saath product banao.`, { duration: 5000 })
      }
    } catch {
      toast.error('Barcode lookup nahi ho paya. Dobara try karo.')
    }
  }

  // Mobile quick-add: same semantics as the desktop QuickAddGrid in the
  // page's right panel (repeat tap increments quantity, first tap fills
  // the empty first line or appends). Before Stage 3 the grid existed
  // only in the desktop split panel, so phone billing had no fast path.
  const handleQuickAddProduct = (product: any) => {
    const currentItems = items || []
    const existingIndex = currentItems.findIndex((i) => i.name === product.name)
    if (existingIndex >= 0) {
      setValue(`items.${existingIndex}.quantity`, (currentItems[existingIndex].quantity || 0) + 1)
      return
    }
    const newItem = {
      name: product.name,
      quantity: 1,
      unit_price: Number(product.price),
      tax_rate: Number(product.tax_rate || 0),
      product_id: product.id,
      unit: 'piece',
      discount_pct: 0,
    }
    const isFirstEmpty = currentItems.length === 1 && !currentItems[0].name?.trim()
    if (isFirstEmpty) {
      setValue('items.0', newItem as any)
    } else {
      append(newItem as any)
    }
  }

  // Item helpers: facts only, totals are derived above.
  const handleItemSelect = (idx: number, productId: string) => {
    const prod = products?.find(p => p.id === productId)
    if (prod) {
      setValue(`items.${idx}.product_id`, prod.id)
      setValue(`items.${idx}.name`, prod.name)
      setValue(`items.${idx}.unit_price`, Number(prod.price))
      setValue(`items.${idx}.tax_rate`, Number(prod.tax_rate || 0))
    }
  }

  return (
    <div className="space-y-6">
      
      {/* --- Customer Section --- */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Bill Kisko Bhejna Hai?</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quick Select */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#98989D] mb-1.5">Purana Customer Select Karo (Ya naya type karo)</label>
            <select 
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm"
              onChange={(e) => {
                const c = customers?.find(x => x.id === e.target.value)
                if (c) {
                  setValue('customer_id', c.id)
                  setValue('customer_name', c.name)
                  setValue('customer_phone', c.phone || '')
                  setValue('customer_address', c.address || '')
                  setValue('customer_gstin', (c as any).gstin || '')
                  setValue(
                    'customer_state_code',
                    (c as any).state_code || stateCodeForName((c as any).state) || '',
                  )
                } else {
                  setValue('customer_id', null)
                  setValue('customer_name', '')
                  setValue('customer_phone', '')
                  setValue('customer_address', '')
                  setValue('customer_gstin', '')
                  setValue('customer_state_code', '')
                }
              }}
            >
              <option value="">-- Naya Customer --</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="inv-customer-name" className="block text-xs font-semibold text-gray-500 dark:text-[#98989D] mb-1.5">Customer Ka Naam *</label>
            <input
              id="inv-customer-name"
              {...register('customer_name')}
              placeholder="Raju Bhai"
              className="w-full px-4 py-2.5 min-h-[48px] bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm focus:border-[#1B7A4A] dark:focus:border-[#25D366] outline-none"
            />
            {errors.customer_name && <p className="text-xs text-red-500 mt-1">{errors.customer_name.message}</p>}
          </div>

          <div>
            <label htmlFor="inv-customer-phone" className="block text-xs font-semibold text-gray-500 dark:text-[#98989D] mb-1.5">Phone Number</label>
            <input
              id="inv-customer-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              {...register('customer_phone')}
              placeholder="9876543210"
              maxLength={10}
              className="w-full px-4 py-2.5 min-h-[48px] bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm focus:border-[#1B7A4A] dark:focus:border-[#25D366] outline-none"
            />
            {errors.customer_phone && <p className="text-xs text-red-500 mt-1">{errors.customer_phone.message}</p>}
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#98989D] mb-1.5">Customer GSTIN (Optional)</label>
            <input
              {...register('customer_gstin')}
              placeholder="29ABCDE1234F1Z5"
              maxLength={15}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm focus:border-[#1B7A4A] dark:focus:border-[#25D366] outline-none uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#98989D] mb-1.5">Customer State (GST ke liye)</label>
            <select
              {...register('customer_state_code')}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm"
            >
              <option value="">-- State select karo --</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
            {totals.is_interstate && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Inter-state supply: IGST lagega</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#98989D] mb-1.5">Address (Optional)</label>
            <textarea
              {...register('customer_address')}
              rows={2}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm focus:border-[#1B7A4A] dark:focus:border-[#25D366] outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* --- Items Section --- */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-5 rounded-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Items</h3>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="tap inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 text-[#1B7A4A] dark:text-[#25D366] text-sm font-bold"
          >
            <ScanLine className="w-4 h-4" aria-hidden="true" />
            Barcode Scan
          </button>
        </div>

        {scannerOpen && (
          <BarcodeScanner onDetected={(code) => void handleBarcode(code)} onClose={() => setScannerOpen(false)} />
        )}

        {/* Mobile quick-add: the desktop split panel does not exist on a
            phone, so the tap-to-add product grid lives here, collapsed
            by default to keep the form short. */}
        <div className="lg:hidden border border-gray-100 dark:border-[#38383A] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setQuickAddOpen((o) => !o)}
            aria-expanded={quickAddOpen}
            className="tap w-full flex items-center justify-between px-4 min-h-[48px] bg-gray-50 dark:bg-[#2C2C2E] text-sm font-bold text-gray-900 dark:text-white"
          >
            <span>Samaan Jaldi Add Karo (tap karke)</span>
            <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${quickAddOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {quickAddOpen && (
            <div className="max-h-[420px] overflow-y-auto">
              <QuickAddGrid onAddProduct={handleQuickAddProduct} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="p-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#48484A] rounded-xl relative group">
              {/* Delete: always visible on touch (44px), hover-reveal on desktop.
                  It was hover-only at 24px before, so a phone user could not remove a wrong line. */}
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Item ${index + 1} hatao`}
                className="tap absolute -top-3 -right-3 sm:-top-2 sm:-right-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-sm z-10"
              >
                ✕
              </button>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-5">
                  <label htmlFor={`item-name-${index}`} className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Item Name</label>
                  {/* Catalog picker: full width on mobile (was squeezed to a
                      third of the row), side by side from sm up. */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      aria-label={`Item ${index + 1} catalog se chuno`}
                      className="w-full sm:w-1/3 min-h-[44px] sm:min-h-0 px-2 py-1.5 text-xs bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg"
                      onChange={(e) => handleItemSelect(index, e.target.value)}
                    >
                      <option value="">-- Catalog --</option>
                      {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      id={`item-name-${index}`}
                      {...register(`items.${index}.name`)}
                      placeholder="Type custom item..."
                      className="flex-1 min-h-[44px] sm:min-h-0 px-3 py-1.5 text-sm bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg focus:border-[#1B7A4A] outline-none"
                    />
                  </div>
                  {errors.items?.[index]?.name && <p className="text-[10px] text-red-500 mt-1">{errors.items[index].name?.message}</p>}
                </div>

                <div className="col-span-4 md:col-span-2">
                  <label htmlFor={`item-qty-${index}`} className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Qty</label>
                  <input
                    id={`item-qty-${index}`}
                    type="number" step="any" inputMode="decimal"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    className="w-full min-h-[44px] sm:min-h-0 px-3 py-1.5 text-sm bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg text-center"
                  />
                </div>

                <div className="col-span-4 md:col-span-2">
                  <label htmlFor={`item-price-${index}`} className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Price</label>
                  <input
                    id={`item-price-${index}`}
                    type="number" step="any" inputMode="decimal"
                    {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                    className="w-full min-h-[44px] sm:min-h-0 px-3 py-1.5 text-sm bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg text-right"
                  />
                </div>

                {isJewellery && (
                  <div className="col-span-4 md:col-span-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 whitespace-nowrap">Making (₹)</label>
                    <input
                      type="number" step="any"
                      {...register(`items.${index}.making_charge`, { valueAsNumber: true })}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg text-right text-purple-600 dark:text-purple-400 font-medium"
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="col-span-4 md:col-span-1">
                  <label htmlFor={`item-gst-${index}`} className="block text-[10px] uppercase font-bold text-gray-500 mb-1">GST%</label>
                  <select
                    id={`item-gst-${index}`}
                    {...register(`items.${index}.tax_rate`, { valueAsNumber: true })}
                    className="w-full min-h-[44px] sm:min-h-0 px-1 py-1.5 text-sm bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-lg"
                  >
                    {ALLOWED_TAX_RATES.map((r) => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </select>
                </div>

                <div className={`col-span-12 flex items-end justify-end ${isJewellery ? 'md:col-span-1' : 'md:col-span-2'}`}>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400">Total</div>
                    <div className="font-bold text-sm">₹{totals.lines[index]?.total?.toFixed(2) || '0.00'}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <button 
            type="button" 
            onClick={() => append({ name: '', quantity: 1, unit_price: 0, tax_rate: 0, unit: 'piece', discount_pct: 0 })}
            className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-[#48484A] rounded-xl text-sm font-semibold text-[#1B7A4A] dark:text-[#25D366] hover:bg-[#1B7A4A]/5 dark:hover:bg-[#25D366]/10 transition-colors"
          >
            + Aur Item Add Karo
          </button>
          {errors.items?.root && <p className="text-xs text-red-500 mt-1">{errors.items.root.message}</p>}
        </div>
      </div>

      {/* --- Discount & Payment --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Discount & Notes */}
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-5 rounded-2xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Discount %</label>
            <input 
              type="number" step="any" min="0" max="100"
              {...register('discount_pct', { valueAsNumber: true })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes (Customer ko dikhega)</label>
            <textarea 
              {...register('notes')}
              rows={3}
              placeholder="Thanks for shopping!"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm resize-none"
            />
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-100 dark:border-[#38383A] pb-2">Payment Status</h3>
          
          <div className="flex gap-3">
            {[
              { id: 'unpaid', label: 'Unpaid / Udhaar', color: 'bg-red-100 text-red-700 ring-red-500' },
              { id: 'partial', label: 'Partial', color: 'bg-yellow-100 text-yellow-700 ring-yellow-500' },
              { id: 'paid', label: 'Paid Full', color: 'bg-green-100 text-green-700 ring-green-500' }
            ].map(st => (
              <label 
                key={st.id} 
                className={`flex-1 text-center py-2 rounded-lg text-xs font-bold cursor-pointer transition-all border ${paymentStatus === st.id ? `ring-2 ${st.color} border-transparent` : 'bg-gray-50 dark:bg-[#2C2C2E] border-gray-200 dark:border-[#38383A] text-gray-500'}`}
              >
                <input type="radio" value={st.id} {...register('payment_status')} className="hidden" />
                {st.label}
              </label>
            ))}
          </div>

          {paymentStatus !== 'unpaid' && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Amount Paid</label>
                <input 
                  type="number" step="any"
                  {...register('amount_paid', { valueAsNumber: true })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mode</label>
                <select 
                  {...register('payment_mode')}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / Online</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>
          )}

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('include_upi_qr')} className="w-4 h-4 rounded text-[#1B7A4A] focus:ring-[#1B7A4A]" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bill pe UPI QR Code dikhao?</span>
            </label>
          </div>
        </div>

      </div>

    </div>
  )
}
