'use client'

import { useRef } from 'react'
import { toast } from 'sonner'
import type { OnboardingData } from '@/app/(auth)/onboarding/page'

interface Props {
  data: OnboardingData
  updateData: (u: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

export default function StepUPI({ data, updateData, onNext, onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleQR = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('QR image must be under 2MB'); return }
    updateData({ upiQrFile: file, upiQrPreview: URL.createObjectURL(file) })
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#34C759]/10 dark:bg-[#34C759]/20 rounded-[28px] mb-6 shadow-sm shadow-[#34C759]/5">
          <span className="text-[40px]">💳</span>
        </div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3 leading-tight">
          Setup Payments
        </h1>
        <p className="text-[15px] text-[#86868B] dark:text-[#98989D] font-medium max-w-sm mx-auto">
          Add your UPI ID or QR code to let customers pay directly from the invoice.
        </p>
      </div>

      <div className="space-y-6 flex-1">
        {/* UPI ID */}
        <div>
          <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1 uppercase tracking-wider">
            UPI ID
          </label>
          <input
            type="text"
            value={data.upiId}
            onChange={(e) => updateData({ upiId: e.target.value.trim() })}
            placeholder="yourname@upi"
            className="w-full px-4 py-4 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#98989D] outline-none focus:border-[#34C759] focus:ring-4 focus:ring-[#34C759]/10 transition-all duration-300 shadow-sm"
          />
          <p className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D] mt-2 ml-1">
            GPay, PhonePe, Paytm, BHIM — any UPI ID works.
          </p>
        </div>

        {/* QR Upload */}
        <div>
          <div className="flex items-center justify-between mb-2 mx-1">
            <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] uppercase tracking-wider">
              UPI QR Code
            </label>
            <span className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D]">Optional</span>
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            className="bg-white/50 dark:bg-[#2C2C2E]/50 border-2 border-dashed border-black/10 dark:border-white/10 hover:border-[#34C759]/50 rounded-[24px] p-6 text-center cursor-pointer transition-all duration-300 hover:bg-[#34C759]/5 group shadow-sm"
          >
            {data.upiQrPreview ? (
              <div className="flex flex-col items-center gap-3">
                <img src={data.upiQrPreview} alt="QR" className="w-24 h-24 rounded-2xl object-cover shadow-sm" />
                <span className="text-[14px] font-semibold text-[#34C759]">Tap to change QR</span>
              </div>
            ) : (
              <div className="py-2 flex flex-col items-center">
                <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-[20px] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-3xl">📷</span>
                </div>
                <p className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Upload QR Code image</p>
                <p className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D] mt-1">Screenshot or saved QR from your payment app</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleQR} className="hidden" />
        </div>

        {/* Toggle: include QR in invoices */}
        <div 
          onClick={() => updateData({ includeUpiQr: !data.includeUpiQr })}
          className="bg-white/50 dark:bg-[#2C2C2E]/50 border border-black/5 dark:border-white/5 rounded-[24px] p-6 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-300 shadow-sm mt-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7]">Show QR on invoices?</div>
              <div className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D] mt-1">Customers can scan to pay instantly</div>
            </div>
            
            <div
              className={`relative w-[52px] h-[32px] rounded-full transition-colors duration-300 ease-in-out shadow-inner flex-shrink-0 ${
                data.includeUpiQr ? 'bg-[#34C759]' : 'bg-[#E5E5EA] dark:bg-[#3A3A3C]'
              }`}
            >
              <div
                className={`absolute top-[2px] w-[28px] h-[28px] bg-white rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-in-out ${
                  data.includeUpiQr ? 'translate-x-[22px]' : 'translate-x-[2px]'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 flex gap-3">
        <button onClick={onBack} className="px-6 py-4 bg-transparent border border-black/10 dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[16px] hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-300">
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[16px] rounded-2xl transition-all duration-300 shadow-sm shadow-[#1B7A4A]/20"
        >
          {data.upiId || data.upiQrFile ? 'Continue' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
