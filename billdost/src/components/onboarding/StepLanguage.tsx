'use client'

import type { OnboardingData } from '@/components/onboarding/types'

interface Props {
  data: OnboardingData
  updateData: (u: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

const LANGUAGES = [
  {
    id: 'hinglish',
    name: 'Hinglish',
    native: 'English + हिन्दी mix',
    desc: 'Jaise aap baat karte ho - sabse popular',
    preview: '"Namaskar! Aapka bill ready hai 🧾"',
    bg: '#34C759',
    recommended: true,
  },
  {
    id: 'en',
    name: 'English',
    native: 'English',
    desc: 'Full English interface & invoices',
    preview: '"Hello! Your invoice is ready 🧾"',
    bg: '#0A84FF',
    recommended: false,
  },
  {
    id: 'hi',
    name: 'Hindi',
    native: 'हिन्दी',
    desc: 'पूरा हिन्दी - मेनू और बिल दोनों',
    preview: '"नमस्कार! आपका बिल तैयार है 🧾"',
    bg: '#FF9F0A',
    recommended: false,
  },
  {
    id: 'kn',
    name: 'Kannada',
    native: 'ಕನ್ನಡ',
    desc: 'ಪೂರ್ಣ ಕನ್ನಡ - ಮೆನು ಮತ್ತು ಬಿಲ್',
    preview: '"ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಬಿಲ್ ಸಿದ್ಧವಾಗಿದೆ 🧾"',
    bg: '#FF375F',
    recommended: false,
  },
]

export default function StepLanguage({ data, updateData, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FF2D55]/10 dark:bg-[#FF2D55]/20 rounded-[28px] mb-6 shadow-sm shadow-[#FF2D55]/5">
          <span className="text-[40px]">🌐</span>
        </div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3 leading-tight">
          Choose Language
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium max-w-sm mx-auto">
          This language will be used across your dashboard and on customer invoices.
        </p>
      </div>

      {/* Language cards */}
      <div className="space-y-4 flex-1">
        {LANGUAGES.map((lang) => {
          const isSelected = data.language === lang.id

          return (
            <button
              key={lang.id}
              onClick={() => updateData({ language: lang.id })}
              className={`relative w-full text-left p-5 rounded-[24px] border-2 transition-all duration-300 group ${
                isSelected
                  ? 'border-[#1B7A4A] dark:border-[#25D366] bg-[#1B7A4A]/5 dark:bg-[#25D366]/10 shadow-md scale-[1.02]'
                  : 'border-transparent bg-white/50 dark:bg-[#2C2C2E]/50 hover:bg-black/5 dark:hover:bg-white/5 hover:scale-[1.01] shadow-sm'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-[18px] flex items-center justify-center flex-shrink-0 text-[18px] font-extrabold shadow-sm"
                  style={{ backgroundColor: `${lang.bg}20`, color: lang.bg }} // 20 is hex for 12% opacity
                >
                  {lang.native.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7]">{lang.name}</span>
                    <span className="text-[13px] font-medium text-[#6E6E73] dark:text-[#98989D]">{lang.native}</span>
                    {lang.recommended && (
                      <span className="text-[10px] font-bold px-2.5 py-1 bg-[#34C759] text-white rounded-md tracking-wider shadow-sm">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-medium text-[#6E6E73] dark:text-[#98989D] mb-3 leading-snug">{lang.desc}</p>
                  
                  <div className={`inline-block px-4 py-2 rounded-xl transition-colors duration-300 ${isSelected ? 'bg-white dark:bg-[#1C1C1E] shadow-sm' : 'bg-black/5 dark:bg-white/5 group-hover:bg-black/10 dark:group-hover:bg-white/10'}`}>
                    <p className="text-[13px] font-semibold italic text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {lang.preview}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-5 right-5 w-7 h-7 bg-[#1B7A4A] dark:bg-[#25D366] rounded-full flex items-center justify-center shadow-sm animate-in zoom-in duration-200">
                    <span className="text-white dark:text-[#1D1D1F] text-[14px] font-bold">✓</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
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
          Continue
        </button>
      </div>
    </div>
  )
}
