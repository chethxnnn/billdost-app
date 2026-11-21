'use client'

import { useState } from 'react'
import type { OnboardingData } from '@/components/onboarding/types'

interface Props {
  data: OnboardingData
  updateData: (u: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

export default function StepAdmin({ data, updateData, onNext, onBack }: Props) {
  const [showStaff, setShowStaff] = useState(data.staffMembers.length > 0)

  const addStaff = () => {
    updateData({
      staffMembers: [...data.staffMembers, { name: '', phone: '', role: 'billing' }],
    })
  }

  const removeStaff = (idx: number) => {
    updateData({ staffMembers: data.staffMembers.filter((_, i) => i !== idx) })
  }

  const updateStaff = (idx: number, field: string, val: string) => {
    const updated = [...data.staffMembers]
    updated[idx] = { ...updated[idx], [field]: val }
    updateData({ staffMembers: updated })
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#5856D6]/10 dark:bg-[#5856D6]/20 rounded-[28px] mb-6 shadow-sm shadow-[#5856D6]/5">
          <span className="text-[40px]">🔐</span>
        </div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3 leading-tight">
          Admin Setup
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium max-w-sm mx-auto">
          Optionally invite your staff and give them billing or viewing access.
        </p>
      </div>

      <div className="space-y-6 flex-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {/* Staff toggle */}
        <div 
          onClick={() => {
            setShowStaff(!showStaff)
            if (!showStaff && data.staffMembers.length === 0) {
              addStaff()
            }
          }}
          className="bg-white/50 dark:bg-[#2C2C2E]/50 border border-black/5 dark:border-white/5 rounded-[24px] p-6 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-300 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[16px] text-[#1D1D1F] dark:text-[#F5F5F7]">Add Staff Members?</div>
              <div className="text-[13px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-1">Give billing or viewing access to employees</div>
            </div>
            
            <div
              className={`relative w-[52px] h-[32px] rounded-full transition-colors duration-300 ease-in-out shadow-inner flex-shrink-0 ${
                showStaff ? 'bg-[#34C759]' : 'bg-[#E5E5EA] dark:bg-[#3A3A3C]'
              }`}
            >
              <div
                className={`absolute top-[2px] w-[28px] h-[28px] bg-white rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-in-out ${
                  showStaff ? 'translate-x-[22px]' : 'translate-x-[2px]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Staff list */}
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showStaff ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="space-y-4">
            {data.staffMembers.map((s, i) => (
              <div key={i} className="bg-white/50 dark:bg-[#2C2C2E]/50 border border-black/5 dark:border-white/5 rounded-[24px] p-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex gap-3 mb-3">
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => updateStaff(i, 'name', e.target.value)}
                    placeholder="Staff Name"
                    className="flex-1 px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none focus:border-[#5856D6] focus:ring-4 focus:ring-[#5856D6]/10 transition-all duration-300"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStaff(i); }}
                    className="w-12 h-[46px] flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:bg-[#FF3B30]/10 dark:hover:bg-[#FF453A]/10 hover:text-[#FF3B30] dark:hover:text-[#FF453A] rounded-xl transition-colors bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center flex-1 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-[#5856D6] focus-within:ring-4 focus-within:ring-[#5856D6]/10 transition-all duration-300">
                    <span className="text-[15px] font-bold text-[#6E6E73] dark:text-[#98989D] mr-2">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={s.phone}
                      onChange={(e) => updateStaff(i, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      className="flex-1 bg-transparent text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] outline-none placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D]"
                    />
                  </div>
                  <select
                    value={s.role}
                    onChange={(e) => updateStaff(i, 'role', e.target.value)}
                    className="px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#5856D6] focus:ring-4 focus:ring-[#5856D6]/10 transition-all duration-300"
                  >
                    <option value="billing">Billing Role</option>
                    <option value="viewer">Viewer Role</option>
                  </select>
                </div>
              </div>
            ))}
            <button
              onClick={addStaff}
              className="w-full py-4 border-2 border-dashed border-black/10 dark:border-white/10 hover:border-[#5856D6]/50 rounded-[20px] text-[15px] font-bold text-[#6E6E73] dark:text-[#98989D] hover:text-[#5856D6] hover:bg-[#5856D6]/5 transition-all duration-300"
            >
              + Add another staff member
            </button>
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
          Continue
        </button>
      </div>
    </div>
  )
}
