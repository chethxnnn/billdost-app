'use client'

import type { OnboardingData } from '@/components/onboarding/types'

interface Props {
  data: OnboardingData
  updateData: (u: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

const CATEGORIES = [
  { id: 'kirana', label: 'Kirana Store', desc: 'Grocery & general items', icon: '🛒', bg: '#FF9F0A' },
  { id: 'dhaba', label: 'Dhaba / Food', desc: 'Food & beverages', icon: '🍛', bg: '#34C759' },
  { id: 'salon', label: 'Salon / Parlour', desc: 'Beauty & grooming', icon: '✂️', bg: '#AF52DE' },
  { id: 'repair', label: 'Repair Shop', desc: 'Mobile, electrical, etc.', icon: '🔧', bg: '#0A84FF' },
  { id: 'wholesale', label: 'Wholesale', desc: 'Bulk & B2B sales', icon: '🏪', bg: '#FFD60A' },
  { id: 'medical', label: 'Medical Store', desc: 'Pharmacy & healthcare', icon: '💊', bg: '#FF375F' },
  { id: 'other', label: 'Other', desc: 'Custom setup', icon: '📦', bg: '#8E8E93' },
]

export default function StepCategory({ data, updateData, onNext, onBack }: Props) {
  const handleSelect = (id: string) => {
    updateData({ category: id })
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FF9F0A]/10 dark:bg-[#FF9F0A]/20 rounded-[28px] mb-6 shadow-sm shadow-[#FF9F0A]/5">
          <span className="text-[40px]">📂</span>
        </div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3 leading-tight">
          What type of business?
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium max-w-sm mx-auto">
          We'll tailor your default products and settings based on this.
        </p>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 gap-3 mb-8 flex-1">
        {CATEGORIES.map((cat) => {
          const isSelected = data.category === cat.id
          
          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              className={`relative text-left p-4 md:p-5 rounded-3xl border-2 transition-all duration-300 ${
                isSelected
                  ? 'border-[#1B7A4A] dark:border-[#25D366] bg-[#1B7A4A]/5 dark:bg-[#25D366]/10 shadow-md scale-[1.02]'
                  : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 hover:scale-[1.01]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-[#1B7A4A] dark:bg-[#25D366] rounded-full flex items-center justify-center shadow-sm animate-in zoom-in duration-200">
                  <span className="text-white dark:text-[#1D1D1F] text-[12px] font-bold">✓</span>
                </div>
              )}
              <div
                className="w-12 h-12 rounded-[16px] flex items-center justify-center mb-3 shadow-sm"
                style={{ backgroundColor: `${cat.bg}20` }} // 20 is hex for 12% opacity
              >
                <span className="text-2xl">{cat.icon}</span>
              </div>
              <div className="font-bold text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] leading-tight mb-1">{cat.label}</div>
              <div className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] leading-snug">{cat.desc}</div>
            </button>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="mt-4 pt-6 border-t border-black/5 dark:border-white/5 flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-4 bg-transparent border border-black/10 dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[16px] hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-300"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!data.category}
          className="flex-1 py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white dark:text-[#1D1D1F] font-bold text-[16px] rounded-2xl transition-all duration-300 shadow-sm shadow-[#1B7A4A]/20"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
