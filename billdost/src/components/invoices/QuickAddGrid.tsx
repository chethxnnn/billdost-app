'use client'

import { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  category?: string | null
  tax_rate?: number
}

interface Props {
  onAddProduct: (product: Product) => void
}

export function QuickAddGrid({ onAddProduct }: Props) {
  const { data: products, isLoading } = trpc.products.list.useQuery({ active: true })
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [search, setSearch] = useState('')

  // Derive categories from active products
  const categories = useMemo(() => {
    if (!products) return ['All']
    const cats = new Set(products.map(p => p.category).filter(Boolean))
    return ['All', ...Array.from(cats)] as string[]
  }, [products])

  // Filter products based on search and selected category
  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [products, search, activeCategory])

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-[#1B7A4A] border-t-transparent rounded-full" />
        <p className="text-sm font-medium text-gray-500">Loading catalog...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#161513] rounded-3xl border border-gray-100 dark:border-[#2E2C28] overflow-hidden shadow-sm">
      
      {/* Header & Search */}
      <div className="p-4 border-b border-gray-100 dark:border-[#2E2C28] space-y-4 bg-gray-50/50 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-[16px] text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚡️</span> Quick Add
          </h2>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search items..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm font-medium outline-none focus:border-[#1B7A4A] transition-all placeholder:font-normal"
          />
        </div>
      </div>

      {/* Category Tabs (Horizontal Scroll) */}
      <div className="w-full overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-[#2E2C28]">
        <div className="flex gap-2 p-3 w-max">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                activeCategory === cat 
                  ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-black shadow-md' 
                  : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredProducts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-10"
            >
              <p className="text-gray-400 text-sm font-medium">No items found.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map(product => (
                <motion.button
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={product.id}
                  onClick={() => onAddProduct(product as any)}
                  className="flex flex-col items-start p-3 bg-gray-50 dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#2E2C28] rounded-2xl hover:border-[#1B7A4A] hover:shadow-md hover:shadow-[#1B7A4A]/10 transition-all active:scale-95 text-left group"
                >
                  <div className="w-full flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2E] flex items-center justify-center text-[15px] shadow-sm font-bold text-gray-700 dark:text-gray-200">
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <h3 className="font-bold text-[13px] text-gray-900 dark:text-white leading-tight line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-[#1B7A4A] dark:text-[#25D366] font-extrabold text-[14px] mt-1">
                    ₹{product.price}
                  </p>
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}
