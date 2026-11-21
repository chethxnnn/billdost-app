'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Store, MapPin, Phone, IndianRupee, FileText, ImagePlus, Loader2, LogOut, Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useLogout } from '@/lib/use-logout'
import { createClient } from '@/lib/supabase/client'

export default function GeneralSettingsPage() {
  const { t } = useTranslation()
  const logout = useLogout()
  const { data: shop, isLoading } = trpc.settings.getShopSettings.useQuery()
  const updateMutation = trpc.settings.updateGeneral.useMutation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

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
        logo_url: shop.logo_url || ''
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

  /**
   * Logo upload to the public `logos` storage bucket (same path pattern
   * onboarding uses). Replaces the old paste-a-URL field, which asked a
   * non-technical shopkeeper for an image URL they do not have.
   */
  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Sirf image file chalegi (PNG ya JPG).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo 2 MB se chhota rakho.')
      return
    }
    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${user.id}/logo.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      // Cache-bust so the new logo shows immediately everywhere.
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`
      setForm((f) => ({ ...f, logo_url: publicUrl }))
      toast.success('Logo lag gaya. Save karna mat bhoolna.')
    } catch (err: any) {
      toast.error(err.message || 'Logo upload nahi hua. Dobara try karo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  if (isLoading) return <div className="animate-pulse space-y-4 p-8 bg-white dark:bg-[#1C1C1E] rounded-3xl ios-shadow h-96" />

  const labelClass = "block text-xs font-bold text-gray-500 dark:text-[#98989D] uppercase tracking-wider mb-2 flex items-center gap-2"
  const inputClass = "w-full bg-gray-50 dark:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all min-h-[48px]"

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl ios-shadow overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-[#38383A]">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings', 'general_profile')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('settings', 'profile_desc')}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shop Name */}
            <div>
              <label htmlFor="shop-name" className={labelClass}>
                <Store className="w-4 h-4" /> {t('settings', 'shop_name')}
              </label>
              <input
                id="shop-name"
                type="text"
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className={inputClass}
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="shop-phone" className={labelClass}>
                <Phone className="w-4 h-4" /> {t('settings', 'phone_number')}
              </label>
              <input
                id="shop-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className={inputClass}
              />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label htmlFor="shop-address" className={labelClass}>
                <MapPin className="w-4 h-4" /> {t('settings', 'complete_address')}
              </label>
              <textarea
                id="shop-address"
                rows={2}
                value={form.address}
                onChange={e => setForm({...form, address: e.target.value})}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* GSTIN */}
            <div>
              <label htmlFor="shop-gstin" className={labelClass}>
                <FileText className="w-4 h-4" /> {t('settings', 'gstin')}
              </label>
              <input
                id="shop-gstin"
                type="text"
                value={form.gstin}
                onChange={e => setForm({...form, gstin: e.target.value?.toUpperCase()})}
                placeholder="29ABCDE1234F1Z5"
                className={inputClass}
              />
            </div>

            {/* UPI ID */}
            <div>
              <label htmlFor="shop-upi" className={labelClass}>
                <IndianRupee className="w-4 h-4" /> {t('settings', 'upi_id')}
              </label>
              <input
                id="shop-upi"
                type="text"
                value={form.upi_id}
                onChange={e => setForm({...form, upi_id: e.target.value})}
                placeholder="shop@upi"
                className={inputClass}
              />
            </div>

            {/* Logo upload (was: paste a URL) */}
            <div className="md:col-span-2">
              <span className={labelClass} id="shop-logo-label">
                <ImagePlus className="w-4 h-4" /> Shop Logo
              </span>
              <div className="flex items-center gap-4" role="group" aria-labelledby="shop-logo-label">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] overflow-hidden flex items-center justify-center shrink-0">
                  {form.logo_url ? (
                    <Image src={form.logo_url} alt="Shop logo" width={64} height={64} className="w-full h-full object-contain" unoptimized />
                  ) : (
                    <Store className="w-6 h-6 text-gray-400" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="tap inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-4 h-4" aria-hidden="true" />}
                    {form.logo_url ? 'Logo Badlo' : 'Logo Lagao'}
                  </button>
                  {form.logo_url && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, logo_url: '' }))}
                      className="tap inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-gray-200 dark:border-[#38383A] text-sm font-bold text-[#FF3B30] dark:text-[#FF453A] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      Hatao
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Shop logo image chuno"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleLogoUpload(file)
                    e.target.value = ''
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">PNG ya JPG, 2 MB tak. Logo aapke bills par dikhega.</p>
            </div>

            {/* App language: reachable on mobile here (sidebar switcher is desktop-only) */}
            <div className="md:col-span-2">
              <span className={labelClass} id="shop-language-label">App Language / Bhasha</span>
              <div role="group" aria-labelledby="shop-language-label">
                <LanguageSwitcher id="settings-language-switcher" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-[#38383A] flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="tap px-8 py-3 min-h-[48px] bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : t('settings', 'save_changes')}
            </button>
          </div>
        </form>
      </div>

      {/* Account: logout lives here too, so mobile users (More -> Settings) can always sign out */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl ios-shadow p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Account</h2>
          <p className="text-sm text-gray-500 mt-0.5">Shared device par kaam khatam ho to logout karna mat bhoolna.</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="tap inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl border border-[#FF3B30]/30 text-[#FF3B30] dark:text-[#FF453A] font-bold transition-colors hover:bg-[#FF3B30]/10"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Logout
        </button>
      </div>
    </div>
  )
}
