'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, PackageOpen } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  category?: string | null
  tax_rate?: number
}

interface Props {
  onAddProduct: (product: Product) => void
  /** POS counter mode: bigger tiles and type for gloved, hurried taps. */
  large?: boolean
}

export function QuickAddGrid({ onAddProduct, large = false }: Props) {
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
    // Skeleton tiles in the real card shell (fix round 2, Stage 5):
    // the old spinner floated in an unstyled box, and inside the
    // bill page's tall right panel the whole area read as a blank
    // white slab while loading, and nearly the same when the
    // catalog was empty (one small grey line). Both states are now
    // unmistakable.
    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#1C1C1E] rounded-3xl border border-gray-100 dark:border-[#38383A] overflow-hidden shadow-sm" aria-busy="true" aria-label="Catalog load ho raha hai">
        <div className="p-4 border-b border-gray-100 dark:border-[#38383A] space-y-4 bg-gray-50/50 dark:bg-white/5">
          <div className="h-5 w-28 rounded-md bg-black/[0.07] dark:bg-white/[0.09] animate-pulse" />
          <div className="h-9 w-full rounded-xl bg-black/[0.05] dark:bg-white/[0.07] animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[92px] rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1C1C1E] rounded-3xl border border-gray-100 dark:border-[#38383A] overflow-hidden shadow-sm">
      
      {/* Header & Search */}
      <div className="p-4 border-b border-gray-100 dark:border-[#38383A] space-y-4 bg-gray-50/50 dark:bg-white/5">
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
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm font-medium outline-none focus:border-[#1B7A4A] transition-all placeholder:font-normal"
          />
        </div>
      </div>

      {/* Category Tabs (Horizontal Scroll) */}
      <div className="w-full overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-[#38383A]">
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
          {filteredProducts.length === 0 && (!products || products.length === 0) ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center px-6 py-10"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 flex items-center justify-center mb-3">
                <PackageOpen className="w-7 h-7 text-[#1B7A4A] dark:text-[#25D366]" aria-hidden="true" />
              </div>
              <p className="font-bold text-[15px] text-gray-900 dark:text-white">Catalog ke items yahan dikhenge</p>
              <p className="text-sm text-gray-500 dark:text-[#98989D] font-medium mt-1 max-w-[260px]">
                Pehle Catalog mein items add karo, phir yahan tap karke bill mein jaldi add ho jayenge.
              </p>
              <Link
                href="/catalog"
                className="tap mt-4 inline-flex items-center min-h-[44px] px-5 rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-bold transition-colors"
              >
                Catalog kholo
              </Link>
            </motion.div>
          ) : filteredProducts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-10 px-4"
            >
              <p className="text-gray-400 text-sm font-medium">No items found.</p>
              <button
                type="button"
                onClick={() => { setSearch(''); setActiveCategory('All') }}
                className="mt-2 text-sm font-bold text-[#1B7A4A] dark:text-[#25D366] hover:underline"
              >
                Search saaf karo
              </button>
            </motion.div>
          ) : (
            <div className={`grid grid-cols-2 lg:grid-cols-3 ${large ? 'gap-4' : 'gap-3'}`}>
              {filteredProducts.map(product => (
                <motion.button
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={product.id}
                  onClick={() => onAddProduct(product as any)}
                  className={`flex flex-col items-start bg-gray-50 dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-2xl hover:border-[#1B7A4A] hover:shadow-md hover:shadow-[#1B7A4A]/10 transition-all active:scale-95 text-left group ${large ? 'p-4 min-h-[104px]' : 'p-3'}`}
                >
                  <div className="w-full flex items-start justify-between mb-2">
                    <div className={`rounded-full bg-white dark:bg-[#2C2C2E] flex items-center justify-center shadow-sm font-bold text-gray-700 dark:text-gray-200 ${large ? 'w-10 h-10 text-[17px]' : 'w-8 h-8 text-[15px]'}`}>
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <h3 className={`font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 ${large ? 'text-[15px]' : 'text-[13px]'}`}>
                    {product.name}
                  </h3>
                  <p className={`text-[#1B7A4A] dark:text-[#25D366] font-extrabold mt-1 ${large ? 'text-[16px]' : 'text-[14px]'}`}>
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
