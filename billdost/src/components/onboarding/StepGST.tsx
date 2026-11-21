'use client'

import type { OnboardingData } from '@/components/onboarding/types'

interface Props {
  data: OnboardingData
  updateData: (u: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export default function StepGST({ data, updateData, onNext, onBack }: Props) {
  const gstinValid = !data.hasGST || GSTIN_REGEX.test(data.gstin.toUpperCase())

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#0A84FF]/10 dark:bg-[#0A84FF]/20 rounded-[28px] mb-6 shadow-sm shadow-[#0A84FF]/5">
          <span className="text-[40px]">📋</span>
        </div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3 leading-tight">
          Are you GST registered?
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium max-w-sm mx-auto">
          If yes, your invoices will include GSTIN and automated tax breakdowns.
        </p>
      </div>

      <div className="space-y-6 flex-1">
        {/* Toggle */}
        <div 
          onClick={() => updateData({ hasGST: !data.hasGST, gstin: '' })}
          className="bg-white/50 dark:bg-[#2C2C2E]/50 border border-black/5 dark:border-white/5 rounded-[24px] p-6 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-300 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7]">GST Registration</div>
              <div className="text-[13px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-1">Do you have a valid GSTIN?</div>
            </div>
            
            {/* Apple-style Switch */}
            <div
              className={`relative w-[52px] h-[32px] rounded-full transition-colors duration-300 ease-in-out shadow-inner ${
                data.hasGST ? 'bg-[#34C759]' : 'bg-[#E5E5EA] dark:bg-[#3A3A3C]'
              }`}
            >
              <div
                className={`absolute top-[2px] w-[28px] h-[28px] bg-white rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-in-out ${
                  data.hasGST ? 'translate-x-[22px]' : 'translate-x-[2px]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* GSTIN input */}
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${data.hasGST ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="bg-white/50 dark:bg-[#2C2C2E]/50 border border-black/5 dark:border-white/5 rounded-[24px] p-6 shadow-sm">
            <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1 uppercase tracking-wider">
              GSTIN Number
            </label>
            <input
              type="text"
              value={data.gstin}
              onChange={(e) => updateData({ gstin: e.target.value.toUpperCase().slice(0, 15) })}
              placeholder="27AABCU9603R1ZX"
              maxLength={15}
              className={`w-full px-4 py-4 bg-white dark:bg-[#1C1C1E] border rounded-2xl text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7] font-mono tracking-widest placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none transition-all duration-300 shadow-sm ${
                data.gstin.length === 15
                  ? gstinValid
                    ? 'border-[#34C759] focus:ring-4 focus:ring-[#34C759]/20'
                    : 'border-[#FF3B30] dark:border-[#FF453A] focus:ring-4 focus:ring-[#FF3B30]/20 dark:focus:ring-[#FF453A]/20'
                  : 'border-black/10 dark:border-white/10 focus:border-[#0A84FF] focus:ring-4 focus:ring-[#0A84FF]/20'
              }`}
            />
            {data.gstin.length === 15 && (
              <p className={`text-[13px] font-semibold mt-3 ml-1 ${gstinValid ? 'text-[#34C759]' : 'text-[#FF3B30] dark:text-[#FF453A]'}`}>
                {gstinValid ? '✓ Valid GSTIN format' : '⚠️ Invalid format - 15 characters, e.g. 27AABCU9603R1ZX'}
              </p>
            )}
            {data.gstin.length > 0 && data.gstin.length < 15 && (
              <p className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-3 ml-1">
                Format: 2 digits + 10 char PAN + 1 entity + Z + 1 checksum
              </p>
            )}
          </div>
        </div>

        {!data.hasGST && (
          <div className="bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 rounded-[20px] p-5 flex items-start gap-3 animate-in fade-in duration-500">
            <span className="text-xl mt-0.5">💡</span>
            <p className="text-[14px] font-medium text-[#8D5A00] dark:text-[#FFC466] leading-snug">
              No problem! You can always add it later in Settings. We'll generate non-GST invoices for now.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-4 bg-transparent border border-black/10 dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[16px] hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-300"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={data.hasGST && !gstinValid}
          className="flex-1 py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white dark:text-[#1D1D1F] font-bold text-[16px] rounded-2xl transition-all duration-300 shadow-sm shadow-[#1B7A4A]/20"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
