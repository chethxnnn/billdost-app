'use client'

import { useFieldArray, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { trpc } from '@/lib/trpc/client'
import { useState } from 'react'
import { useShop } from '@/components/shared/ShopContext'

/* ─── Schema ─── */
export const invoiceFormSchema = z.object({
  customer_name: z.string().min(1, 'Naam likhna zaroori hai'),
  customer_phone: z.string().max(10, 'Phone number 10 digits se lamba nahi ho sakta').optional().nullable(),
  customer_address: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  
  invoice_date: z.string(),
  due_date: z.string().optional().nullable(),
  
  items: z.array(
    z.object({
      product_id: z.string().optional().nullable(),
      name: z.string().min(1, 'Item ka naam likho'),
      quantity: z.number().min(0.01),
      unit_price: z.number().min(0),
      making_charge: z.number().optional().nullable(),
      tax_rate: z.number().default(0),
      // Computed
      tax_amt: z.number().default(0),
      total: z.number().min(0),
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
  
  const { shopCategory } = useShop()
  const isJewellery = shopCategory === 'jewellery'
  
  // Queries
  const { data: customers } = trpc.customers.list.useQuery()
  const { data: products } = trpc.products.list.useQuery()

  // Item helpers
  const handleItemSelect = (idx: number, productId: string) => {
    const prod = products?.find(p => p.id === productId)
    if (prod) {
      setValue(`items.${idx}.name`, prod.name)
      setValue(`items.${idx}.unit_price`, Number(prod.price))
      setValue(`items.${idx}.tax_rate`, Number(prod.tax_rate || 0))
      // trigger computation
      const qty = form.getValues(`items.${idx}.quantity`) || 1
      const price = Number(prod.price)
      const taxRate = Number(prod.tax_rate || 0)
      const makingCharge = form.getValues(`items.${idx}.making_charge`) || 0
      const baseTotal = (qty * price) + makingCharge
      const taxAmt = baseTotal * (taxRate / 100)
      setValue(`items.${idx}.tax_amt`, taxAmt)
      setValue(`items.${idx}.total`, baseTotal + taxAmt)
    }
  }

  const recalcItem = (idx: number) => {
    const qty = form.getValues(`items.${idx}.quantity`) || 0
    const price = form.getValues(`items.${idx}.unit_price`) || 0
    const taxRate = form.getValues(`items.${idx}.tax_rate`) || 0
    const makingCharge = form.getValues(`items.${idx}.making_charge`) || 0
    
    const baseTotal = (qty * price) + makingCharge
    const taxAmt = baseTotal * (taxRate / 100)
    setValue(`items.${idx}.tax_amt`, taxAmt)
    setValue(`items.${idx}.total`, baseTotal + taxAmt)
  }

  return (
    <div className="space-y-6">
      
      {/* --- Customer Section --- */}
      <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Bill Kisko Bhejna Hai?</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quick Select */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] mb-1.5">Purana Customer Select Karo (Ya naya type karo)</label>
            <select 
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm"
              onChange={(e) => {
                const c = customers?.find(x => x.id === e.target.value)
                if (c) {
                  setValue('customer_id', c.id)
                  setValue('customer_name', c.name)
                  setValue('customer_phone', c.phone || '')
                  setValue('customer_address', c.address || '')
                } else {
                  setValue('customer_id', null)
                  setValue('customer_name', '')
                  setValue('customer_phone', '')
                  setValue('customer_address', '')
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
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] mb-1.5">Customer Ka Naam *</label>
            <input 
              {...register('customer_name')}
              placeholder="Raju Bhai"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm focus:border-[#1B7A4A] dark:focus:border-[#2BB673] outline-none"
            />
            {errors.customer_name && <p className="text-xs text-red-500 mt-1">{errors.customer_name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] mb-1.5">Phone Number</label>
            <input 
              {...register('customer_phone')}
              placeholder="9876543210"
              maxLength={10}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm focus:border-[#1B7A4A] dark:focus:border-[#2BB673] outline-none"
            />
            {errors.customer_phone && <p className="text-xs text-red-500 mt-1">{errors.customer_phone.message}</p>}
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] mb-1.5">Address (Optional)</label>
            <textarea 
              {...register('customer_address')}
              rows={2}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm focus:border-[#1B7A4A] dark:focus:border-[#2BB673] outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* --- Items Section --- */}
      <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Items</h3>
        </div>
        
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="p-3 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#3E3C38] rounded-xl relative group">
              <button 
                type="button" 
                onClick={() => remove(index)}
                className="absolute -top-2 -right-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
              >
                ✕
              </button>
              
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-5">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Item Name</label>
                  {/* Catalog picker overlaying the input logic for simplicity */}
                  <div className="flex gap-2">
                    <select 
                      className="w-1/3 px-2 py-1.5 text-xs bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-lg"
                      onChange={(e) => handleItemSelect(index, e.target.value)}
                    >
                      <option value="">-- Catalog --</option>
                      {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input 
                      {...register(`items.${index}.name`)} 
                      placeholder="Type custom item..."
                      className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-lg focus:border-[#1B7A4A] outline-none"
                    />
                  </div>
                  {errors.items?.[index]?.name && <p className="text-[10px] text-red-500 mt-1">{errors.items[index].name?.message}</p>}
                </div>
                
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Qty</label>
                  <input 
                    type="number" step="any"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true, onChange: () => recalcItem(index) })} 
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-lg text-center"
                  />
                </div>

                <div className="col-span-4 md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Price</label>
                  <input 
                    type="number" step="any"
                    {...register(`items.${index}.unit_price`, { valueAsNumber: true, onChange: () => recalcItem(index) })} 
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-lg text-right"
                  />
                </div>

                {isJewellery && (
                  <div className="col-span-4 md:col-span-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 whitespace-nowrap">Making (₹)</label>
                    <input 
                      type="number" step="any"
                      {...register(`items.${index}.making_charge`, { valueAsNumber: true, onChange: () => recalcItem(index) })} 
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-lg text-right text-purple-600 dark:text-purple-400 font-medium"
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="col-span-4 md:col-span-1">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">GST%</label>
                  <select 
                    {...register(`items.${index}.tax_rate`, { valueAsNumber: true, onChange: () => recalcItem(index) })}
                    className="w-full px-1 py-1.5 text-sm bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-lg"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>

                <div className={`col-span-12 flex items-end justify-end ${isJewellery ? 'md:col-span-1' : 'md:col-span-2'}`}>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400">Total</div>
                    <div className="font-bold text-sm">₹{items[index]?.total?.toFixed(2) || '0.00'}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <button 
            type="button" 
            onClick={() => append({ name: '', quantity: 1, unit_price: 0, tax_rate: 0, tax_amt: 0, total: 0 })}
            className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-[#3E3C38] rounded-xl text-sm font-semibold text-[#1B7A4A] dark:text-[#2BB673] hover:bg-[#1B7A4A]/5 dark:hover:bg-[#2BB673]/10 transition-colors"
          >
            + Aur Item Add Karo
          </button>
          {errors.items?.root && <p className="text-xs text-red-500 mt-1">{errors.items.root.message}</p>}
        </div>
      </div>

      {/* --- Discount & Payment --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Discount & Notes */}
        <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Discount %</label>
            <input 
              type="number" step="any" min="0" max="100"
              {...register('discount_pct', { valueAsNumber: true })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes (Customer ko dikhega)</label>
            <textarea 
              {...register('notes')}
              rows={3}
              placeholder="Thanks for shopping!"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm resize-none"
            />
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-100 dark:border-[#2E2C28] pb-2">Payment Status</h3>
          
          <div className="flex gap-3">
            {[
              { id: 'unpaid', label: 'Unpaid / Udhaar', color: 'bg-red-100 text-red-700 ring-red-500' },
              { id: 'partial', label: 'Partial', color: 'bg-yellow-100 text-yellow-700 ring-yellow-500' },
              { id: 'paid', label: 'Paid Full', color: 'bg-green-100 text-green-700 ring-green-500' }
            ].map(st => (
              <label 
                key={st.id} 
                className={`flex-1 text-center py-2 rounded-lg text-xs font-bold cursor-pointer transition-all border ${paymentStatus === st.id ? `ring-2 ${st.color} border-transparent` : 'bg-gray-50 dark:bg-[#1E1C1A] border-gray-200 dark:border-[#2E2C28] text-gray-500'}`}
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
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mode</label>
                <select 
                  {...register('payment_mode')}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm"
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
