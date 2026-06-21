'use client'

import { useFieldArray, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { trpc } from '@/lib/trpc/client'

/* ─── Schema ─── */
export const quotationFormSchema = z.object({
  customer_name: z.string().min(1, 'Naam likhna zaroori hai'),
  customer_phone: z.string().max(10, 'Phone number 10 digits se lamba nahi ho sakta').optional().nullable(),
  customer_address: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  
  valid_until: z.string().optional().nullable(),
  
  items: z.array(
    z.object({
      product_id: z.string().optional().nullable(),
      name: z.string().min(1, 'Item ka naam likho'),
      quantity: z.number().min(0.01),
      unit_price: z.number().min(0),
      total: z.number().min(0),
    })
  ).min(1, 'Kam se kam ek item add karo'),

  discount_pct: z.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
})

export type QuotationFormValues = z.infer<typeof quotationFormSchema>

/* ─── Components ─── */
export function QuotationForm({ form }: { form: UseFormReturn<QuotationFormValues> }) {
  const { register, control, watch, setValue, formState: { errors } } = form
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  })

  const items = watch('items')
  
  // Queries
  const { data: customers } = trpc.customers.list.useQuery()
  const { data: products } = trpc.products.list.useQuery()

  // Item helpers
  const handleItemSelect = (idx: number, productId: string) => {
    const prod = products?.find(p => p.id === productId)
    if (prod) {
      setValue(`items.${idx}.name`, prod.name)
      setValue(`items.${idx}.unit_price`, Number(prod.price))
      // trigger computation
      const qty = form.getValues(`items.${idx}.quantity`) || 1
      const price = Number(prod.price)
      const baseTotal = qty * price
      setValue(`items.${idx}.total`, baseTotal)
    }
  }

  const recalcItem = (idx: number) => {
    const qty = form.getValues(`items.${idx}.quantity`) || 0
    const price = form.getValues(`items.${idx}.unit_price`) || 0
    
    const baseTotal = qty * price
    setValue(`items.${idx}.total`, baseTotal)
  }

  return (
    <div className="space-y-6">
      
      {/* --- Customer Section --- */}
      <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Quotation Kisko Bhejna Hai?</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] mb-1.5">Purana Customer Select Karo</label>
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
        </div>
      </div>

      {/* --- Items Section --- */}
      <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Items</h3>
        
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
                <div className="col-span-12 md:col-span-6">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Item Name</label>
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

                <div className="col-span-4 md:col-span-2 flex items-end justify-end">
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
            onClick={() => append({ name: '', quantity: 1, unit_price: 0, total: 0 })}
            className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-[#3E3C38] rounded-xl text-sm font-semibold text-[#1B7A4A] dark:text-[#2BB673] hover:bg-[#1B7A4A]/5 dark:hover:bg-[#2BB673]/10 transition-colors"
          >
            + Aur Item Add Karo
          </button>
          {errors.items?.root && <p className="text-xs text-red-500 mt-1">{errors.items.root.message}</p>}
        </div>
      </div>

      {/* --- Discount & Details --- */}
      <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] p-5 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Discount %</label>
            <input 
              type="number" step="any" min="0" max="100"
              {...register('discount_pct', { valueAsNumber: true })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Valid Until</label>
            <input 
              type="date"
              {...register('valid_until')}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes (Optional)</label>
          <textarea 
            {...register('notes')}
            rows={2}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm resize-none outline-none focus:border-[#1B7A4A]"
          />
        </div>
      </div>
    </div>
  )
}
