'use client'

import { useState, useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Store, MapPin, Phone, IndianRupee, FileText, Link as LinkIcon, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function GeneralSettingsPage() {
  const { t } = useTranslation()
  const { data: shop, isLoading } = trpc.settings.getShopSettings.useQuery()
  const updateMutation = trpc.settings.updateGeneral.useMutation()

  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: '',
    upi_id: '',
    logo_url: ''
  })

  useEffect(() => {
    if (shop) {
      setForm({
        name: shop.name || '',
        address: shop.address || '',
        phone: shop.phone || '',
        gstin: shop.gstin || '',
        upi_id: shop.upi_id || '',
        logo_url: shop.logo_url || '' // Might be undefined depending on schema, so we default to empty string
      })
    }
  }, [shop])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return toast.error(t('settings', 'shop_name_req'))

    updateMutation.mutate(form, {
      onSuccess: () => toast.success(t('settings', 'settings_updated')),
      onError: (err) => toast.error(err.message)
    })
  }

  if (isLoading) return <div className="animate-pulse space-y-4 p-8 bg-white dark:bg-[#161513] rounded-3xl ios-shadow h-96" />

  return (
    <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-3xl ios-shadow overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-[#2E2C28]">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings', 'general_profile')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('settings', 'profile_desc')}</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shop Name */}
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2 flex items-center gap-2">
              <Store className="w-4 h-4" /> {t('settings', 'shop_name')}
            </label>
            <input 
              type="text" 
              required
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" /> {t('settings', 'phone_number')}
            </label>
            <input 
              type="text" 
              value={form.phone}
              onChange={e => setForm({...form, phone: e.target.value})}
              className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> {t('settings', 'complete_address')}
            </label>
            <textarea 
              rows={2}
              value={form.address}
              onChange={e => setForm({...form, address: e.target.value})}
              className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all resize-none"
            />
          </div>

          {/* GSTIN */}
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" /> {t('settings', 'gstin')}
            </label>
            <input 
              type="text" 
              value={form.gstin}
              onChange={e => setForm({...form, gstin: e.target.value?.toUpperCase()})}
              placeholder="29ABCDE1234F1Z5"
              className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            />
          </div>

          {/* UPI ID */}
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2 flex items-center gap-2">
              <IndianRupee className="w-4 h-4" /> {t('settings', 'upi_id')}
            </label>
            <input 
              type="text" 
              value={form.upi_id}
              onChange={e => setForm({...form, upi_id: e.target.value})}
              placeholder="shop@upi"
              className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            />
          </div>

          {/* Logo URL */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-2 flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> {t('settings', 'logo_url')}
            </label>
            <input 
              type="url" 
              value={form.logo_url}
              onChange={e => setForm({...form, logo_url: e.target.value})}
              placeholder="https://example.com/logo.png"
              className="w-full bg-gray-50 dark:bg-[#1E1C1A] border border-gray-100 dark:border-[#2E2C28] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            />
            <p className="text-xs text-gray-500 mt-2">{t('settings', 'logo_desc')}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-[#2E2C28] flex justify-end">
          <button 
            type="submit"
            disabled={updateMutation.isPending}
            className="px-8 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t('settings', 'save_changes')}
          </button>
        </div>
      </form>
    </div>
  )
}
