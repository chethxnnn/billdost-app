'use client'

import { useState, useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Hash, FileText, Loader2, FileCheck } from 'lucide-react'

export default function InvoiceSettingsPage() {
  const { data: shop, isLoading } = trpc.settings.getShopSettings.useQuery()
  const updateMutation = trpc.settings.updateInvoiceSettings.useMutation()

  const [form, setForm] = useState({
    invoice_prefix: 'INV-',
    invoice_counter: 1000,
    quotation_prefix: 'QT-',
    quotation_counter: 100,
    terms_conditions: '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.'
  })

  useEffect(() => {
    if (shop) {
      setForm({
        invoice_prefix: shop.invoice_prefix || 'INV-',
        invoice_counter: shop.invoice_counter || 1000,
        quotation_prefix: shop.quotation_prefix || 'QT-',
        quotation_counter: shop.quotation_counter || 100,
        terms_conditions: shop.terms_conditions || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.'
      })
    }
  }, [shop])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(form, {
      onSuccess: () => toast.success('Invoice settings saved!'),
      onError: (err) => toast.error(err.message)
    })
  }

  if (isLoading) return <div className="animate-pulse space-y-4 p-8 bg-white dark:bg-[#161513] rounded-3xl ios-shadow h-96" />

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-3xl ios-shadow overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-[#2E2C28]">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invoice & Quotation Defaults</h2>
          <p className="text-sm text-gray-500 mt-1">Control how your bill numbers are generated and what terms appear.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-500" /> Invoices
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2">Prefix</label>
                <input 
                  type="text" 
                  value={form.invoice_prefix}
                  onChange={e => setForm({...form, invoice_prefix: e.target.value.toUpperCase()})}
                  className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Next Invoice Number
                </label>
                <input 
                  type="number" 
                  min={1}
                  value={form.invoice_counter}
                  onChange={e => setForm({...form, invoice_counter: parseInt(e.target.value) || 1})}
                  className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" /> Quotations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2">Prefix</label>
                <input 
                  type="text" 
                  value={form.quotation_prefix}
                  onChange={e => setForm({...form, quotation_prefix: e.target.value.toUpperCase()})}
                  className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Next Quotation Number
                </label>
                <input 
                  type="number" 
                  min={1}
                  value={form.quotation_counter}
                  onChange={e => setForm({...form, quotation_counter: parseInt(e.target.value) || 1})}
                  className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Terms & Conditions</h3>
            <div>
              <textarea 
                rows={4}
                value={form.terms_conditions}
                onChange={e => setForm({...form, terms_conditions: e.target.value})}
                placeholder="1. Goods once sold..."
                className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">These will be printed at the bottom of all your invoices and quotations.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-[#2E2C28] flex justify-end">
            <button 
              type="submit"
              disabled={updateMutation.isPending}
              className="px-8 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
