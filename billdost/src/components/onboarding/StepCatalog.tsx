'use client'

import { useState, useEffect } from 'react'
import type { OnboardingData } from '@/components/onboarding/types'

interface Props {
  data: OnboardingData
  updateData: (u: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

export default function StepCatalog({ data, updateData, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false)

  // Load default catalog based on category
  useEffect(() => {
    if (data.products.length > 0) return // already loaded
    setLoading(true)
    fetch('/default-catalogs/catalogs.json')
      .then((r) => r.json())
      .then((catalogs: Record<string, Array<{ name: string; price: number; unit: string; category: string }>>) => {
        const cat = data.category || 'other'
        const defaults = catalogs[cat] || catalogs['other'] || []
        updateData({ products: defaults })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addProduct = () => {
    updateData({
      products: [...data.products, { name: '', price: 0, unit: 'piece', category: 'General' }],
    })
  }

  const removeProduct = (idx: number) => {
    updateData({ products: data.products.filter((_, i) => i !== idx) })
  }

  const updateProduct = (idx: number, field: string, val: string | number) => {
    const updated = [...data.products]
    updated[idx] = { ...updated[idx], [field]: val }
    updateData({ products: updated })
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#AF52DE]/10 dark:bg-[#AF52DE]/20 rounded-[28px] mb-6 shadow-sm shadow-[#AF52DE]/5">
          <span className="text-[40px]">📦</span>
        </div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3 leading-tight">
          Setup your catalog
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium max-w-sm mx-auto">
          We've added some common items based on your business type. Edit or add your own!
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-black/10 dark:border-white/10 border-t-[#AF52DE] rounded-full animate-spin mb-4" />
          <p className="text-[14px] font-semibold text-[#6E6E73] dark:text-[#98989D]">Loading defaults...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Product list */}
          <div className="space-y-3 mb-6 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
            {data.products.map((p, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white/50 dark:bg-[#2C2C2E]/50 border border-black/5 dark:border-white/5 rounded-[20px] p-4 shadow-sm hover:shadow-md transition-shadow duration-300 group">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updateProduct(i, 'name', e.target.value)}
                  placeholder="Item name"
                  className="flex-1 w-full sm:w-auto min-w-0 px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none focus:border-[#AF52DE] focus:ring-4 focus:ring-[#AF52DE]/10 transition-all duration-300"
                />
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center flex-1 sm:flex-none gap-2 px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl focus-within:border-[#AF52DE] focus-within:ring-4 focus-within:ring-[#AF52DE]/10 transition-all duration-300">
                    <span className="text-[#6E6E73] dark:text-[#98989D] text-[15px] font-bold">₹</span>
                    <input
                      type="number"
                      value={p.price || ''}
                      onChange={(e) => updateProduct(i, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full sm:w-16 bg-transparent text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] outline-none"
                    />
                  </div>
                  <select
                    value={p.unit}
                    onChange={(e) => updateProduct(i, 'unit', e.target.value)}
                    className="px-3 py-3 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-xl text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#AF52DE] focus:ring-4 focus:ring-[#AF52DE]/10 transition-all duration-300"
                  >
                    <option value="piece">piece</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="litre">litre</option>
                    <option value="ml">ml</option>
                    <option value="plate">plate</option>
                    <option value="service">service</option>
                    <option value="strip">strip</option>
                    <option value="dozen">dozen</option>
                  </select>
                  <button
                    onClick={() => removeProduct(i)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-[#6E6E73] dark:text-[#98989D] hover:bg-[#FF3B30]/10 dark:hover:bg-[#FF453A]/10 hover:text-[#FF3B30] dark:hover:text-[#FF453A] transition-colors flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={addProduct}
            className="w-full py-4 border-2 border-dashed border-black/10 dark:border-white/10 hover:border-[#AF52DE]/50 rounded-[20px] text-[15px] font-bold text-[#6E6E73] dark:text-[#98989D] hover:text-[#AF52DE] hover:bg-[#AF52DE]/5 transition-all duration-300"
          >
            + Add another item
          </button>

          <p className="text-[13px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-4 text-center">
            {data.products.length} items • You can always add or edit these later
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5 flex gap-3">
        <button onClick={onBack} className="px-6 py-4 bg-transparent border border-black/10 dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[16px] hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-300">
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[16px] rounded-2xl transition-all duration-300 shadow-sm shadow-[#1B7A4A]/20"
        >
          {data.products.length > 0 ? 'Continue' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
