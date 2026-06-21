'use client'

import { useEffect, useState } from 'react'
import type { OnboardingData } from '@/app/(auth)/onboarding/page'

interface Props {
  data: OnboardingData
  saving: boolean
  onSave: () => void
  onBack: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  kirana: 'Kirana Store',
  dhaba: 'Dhaba / Food',
  salon: 'Salon / Parlour',
  repair: 'Repair Shop',
  wholesale: 'Wholesale',
  medical: 'Medical Store',
  other: 'Other',
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  kn: 'Kannada (ಕನ್ನಡ)',
  hinglish: 'Hinglish',
}

export default function StepComplete({ data, saving, onSave, onBack }: Props) {
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    setShowConfetti(true)
    const t = setTimeout(() => setShowConfetti(false), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Confetti */}
      {showConfetti && <Confetti />}

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#1B7A4A] to-[#25D366] rounded-[28px] mb-6 shadow-lg shadow-[#25D366]/20">
          <span className="text-[40px]">🎉</span>
        </div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3 leading-tight">
          You're all set!
        </h1>
        <p className="text-[15px] text-[#86868B] dark:text-[#98989D] font-medium max-w-sm mx-auto">
          Your shop is ready on BillDost. Review your details below and let's get started.
        </p>
      </div>

      {/* Summary card - Apple Glass Style */}
      <div className="bg-white/50 dark:bg-[#2C2C2E]/50 border border-black/5 dark:border-white/5 rounded-[32px] overflow-hidden mb-6 shadow-sm">
        {/* Shop header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1B7A4A] to-[#25D366] p-6 flex items-center gap-5">
          {/* Subtle blur overlay for depth */}
          <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-sm z-0"></div>
          
          <div className="relative z-10">
            {data.logoPreview ? (
              <img src={data.logoPreview} alt="" className="w-16 h-16 rounded-[20px] object-cover border-2 border-white/30 shadow-md bg-white" />
            ) : (
              <div className="w-16 h-16 rounded-[20px] bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md border border-white/20">
                <span className="text-white text-[28px] font-extrabold" style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}>
                  {data.shopName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="relative z-10 flex-1 min-w-0">
            <h2 className="text-white font-extrabold text-[20px] truncate tracking-tight mb-1" style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}>
              {data.shopName || 'Your Shop'}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-white/80 text-[13px] font-semibold bg-white/10 px-2.5 py-1 rounded-md">
                {CATEGORY_LABELS[data.category] || 'Business'}
              </span>
              <span className="text-white/80 text-[13px] font-semibold bg-white/10 px-2.5 py-1 rounded-md">
                Free Plan
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-2">
          <SummaryRow label="Category" value={CATEGORY_LABELS[data.category] || '—'} icon="📂" />
          <SummaryRow label="GST" value={data.hasGST ? data.gstin : 'Not registered'} icon="📋" />
          <SummaryRow label="Products" value={`${data.products.length} items`} icon="📦" />
          <SummaryRow label="UPI" value={data.upiId || 'Not set'} icon="💳" />
          <SummaryRow label="Language" value={LANGUAGE_LABELS[data.language] || 'Hinglish'} icon="🌐" />
          <SummaryRow label="Security" value={data.pin ? 'PIN Set' : 'No PIN'} icon="🔐" />
          <SummaryRow label="Staff" value={data.staffMembers.length > 0 ? `${data.staffMembers.length} member(s)` : 'Only you'} icon="👥" />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto">
        <button
          onClick={onSave}
          disabled={saving}
          className="w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white dark:text-[#1D1D1F] font-bold text-[16px] rounded-2xl transition-all duration-300 shadow-lg shadow-[#1B7A4A]/20 flex items-center justify-center gap-3 relative overflow-hidden group"
        >
          {/* Shine effect */}
          <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0"></div>
          
          <div className="relative z-10 flex items-center gap-2">
            {saving ? (
              <>
                <Spinner />
                <span>Setting up your shop...</span>
              </>
            ) : (
              <>
                <span className="text-xl">🚀</span>
                <span>Create my shop</span>
              </>
            )}
          </div>
        </button>

        <button
          onClick={onBack}
          disabled={saving}
          className="w-full mt-4 py-3 text-[14px] font-semibold text-[#86868B] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors"
        >
          Go back to edit details
        </button>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] bg-black/5 dark:bg-white/5 flex items-center justify-center text-lg">
          {icon}
        </div>
        <span className="text-[14px] font-semibold text-[#86868B] dark:text-[#98989D]">{label}</span>
      </div>
      <div className="text-[14px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] text-right max-w-[180px] truncate">
        {value}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => {
        const size = 6 + Math.random() * 8
        return (
          <div
            key={i}
            className="absolute animate-bounce opacity-80"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-${Math.random() * 20}px`,
              width: `${size}px`,
              height: `${size}px`,
              background: ['#34C759', '#0A84FF', '#FF3B30', '#FFCC00', '#AF52DE', '#FF9F0A'][i % 6],
              borderRadius: Math.random() > 0.5 ? '50%' : '4px',
              animation: `confetti-fall ${1.5 + Math.random() * 2.5}s cubic-bezier(.25,.46,.45,.94) forwards`,
              animationDelay: `${Math.random() * 0.8}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        )
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
