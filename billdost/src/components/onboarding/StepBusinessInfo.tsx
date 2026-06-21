'use client'

import { useRef } from 'react'
import { toast } from 'sonner'
import type { OnboardingData } from '@/app/(auth)/onboarding/page'

interface Props {
  data: OnboardingData
  updateData: (u: Partial<OnboardingData>) => void
  onNext: () => void
}

export default function StepBusinessInfo({ data, updateData, onNext }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be smaller than 2MB')
      return
    }
    const preview = URL.createObjectURL(file)
    updateData({ logoFile: file, logoPreview: preview })
  }

  const canProceed = data.shopName.trim().length >= 2

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 rounded-[28px] mb-6 shadow-sm shadow-[#1B7A4A]/5">
          <span className="text-[40px]">🏪</span>
        </div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3 leading-tight">
          What's your business name?
        </h1>
        <p className="text-[15px] text-[#86868B] dark:text-[#98989D] font-medium max-w-sm mx-auto">
          This will appear on all your invoices. You can always change it later in settings.
        </p>
      </div>

      <div className="space-y-8 flex-1">
        {/* Shop name */}
        <div>
          <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1">
            Business Name <span className="text-[#FF3B30] dark:text-[#FF453A]">*</span>
          </label>
          <input
            type="text"
            value={data.shopName}
            onChange={(e) => updateData({ shopName: e.target.value })}
            placeholder="e.g. Sharma General Store"
            autoFocus
            className="w-full px-4 py-4 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300 shadow-sm"
          />
        </div>

        {/* Logo upload */}
        <div>
          <div className="flex items-center justify-between mb-2 mx-1">
            <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Business Logo
            </label>
            <span className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D]">Optional</span>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-black/10 dark:border-white/10 hover:border-[#1B7A4A]/50 dark:hover:border-[#25D366]/50 rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 hover:bg-[#1B7A4A]/5 dark:hover:bg-[#25D366]/5 group bg-white/50 dark:bg-[#2C2C2E]/50"
          >
            {data.logoPreview ? (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={data.logoPreview}
                  alt="Logo preview"
                  className="w-24 h-24 rounded-2xl object-cover shadow-md"
                />
                <span className="text-[14px] font-semibold text-[#1B7A4A] dark:text-[#25D366]">Tap to change photo</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-[20px] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <span className="text-3xl">📸</span>
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Upload a logo</p>
                  <p className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D] mt-1">PNG or JPG, max 2MB</p>
                </div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
          
          <p className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D] mt-4 text-center">
            Don't have a logo? No worries, we'll generate a beautiful initial logo for you! ✨
          </p>
        </div>
      </div>

      {/* Next Button */}
      <div className="mt-10 pt-6 border-t border-black/5 dark:border-white/5">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white dark:text-[#1D1D1F] font-bold text-[16px] rounded-2xl transition-all duration-300 shadow-sm shadow-[#1B7A4A]/20"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
