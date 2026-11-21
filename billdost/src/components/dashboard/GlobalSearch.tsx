'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Package, Search, User } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

/**
 * The Topbar search, made real (it was a decorative input with a fake
 * Cmd+K badge). Debounced shop-scoped search across invoices,
 * customers and products via search.global; Cmd/Ctrl+K genuinely
 * focuses it; results navigate.
 */
export function GlobalSearch({ autoFocus = false, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const { data, isFetching } = trpc.search.global.useQuery(
    { q: debounced },
    { enabled: debounced.length >= 2 }
  )

  const hasResults =
    data && (data.invoices.length > 0 || data.customers.length > 0 || data.products.length > 0)

  const go = (href: string) => {
    setOpen(false)
    setQuery('')
    onNavigate?.()
    router.push(href)
  }

  const itemClass =
    'flex w-full items-center gap-3 px-4 py-2.5 min-h-[44px] text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors'

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="w-full flex items-center gap-2 bg-black/5 dark:bg-white/5 border border-transparent focus-within:border-[#1B7A4A]/30 dark:focus-within:border-[#25D366]/30 focus-within:bg-white dark:focus-within:bg-[#2C2C2E] rounded-2xl px-4 py-2.5 transition-all duration-300">
        <Search className="w-[18px] h-[18px] text-[#6E6E73] dark:text-[#98989D] flex-shrink-0" aria-hidden="true" />
        <label htmlFor="global-search-input" className="sr-only">
          Search invoices, customers, products
        </label>
        <input
          id="global-search-input"
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search invoices, customers..."
          className="flex-1 bg-transparent text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none w-full"
        />
        <kbd className="hidden md:inline text-[11px] font-mono text-[#6E6E73] dark:text-[#98989D] bg-black/5 dark:bg-white/10 rounded-md px-1.5 py-0.5 font-semibold">
          ⌘K
        </kbd>
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
          {isFetching && !data && (
            <p className="px-4 py-3 text-sm text-[#6E6E73] dark:text-[#98989D]">Dhoondh rahe hain...</p>
          )}
          {data && !hasResults && (
            <p className="px-4 py-3 text-sm text-[#6E6E73] dark:text-[#98989D]">
              Kuch nahi mila. Naam ya bill number dobara check karo.
            </p>
          )}
          {data && data.invoices.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">Bills</p>
              {data.invoices.map((inv) => (
                <button key={inv.id} type="button" className={itemClass} onClick={() => go(`/invoices/${inv.id}`)}>
                  <FileText className="w-4 h-4 text-[#1B7A4A] dark:text-[#25D366] shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{inv.invoice_number}</span>
                    <span className="block text-xs text-[#6E6E73] dark:text-[#98989D] truncate">{inv.customer_name}</span>
                  </span>
                  <span className="text-sm font-bold">{formatINR(Number(inv.total))}</span>
                </button>
              ))}
            </div>
          )}
          {data && data.customers.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">Customers</p>
              {data.customers.map((c) => (
                <button key={c.id} type="button" className={itemClass} onClick={() => go('/customers')}>
                  <User className="w-4 h-4 text-[#1B7A4A] dark:text-[#25D366] shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{c.name}</span>
                    {c.phone && <span className="block text-xs text-[#6E6E73] dark:text-[#98989D] truncate">{c.phone}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
          {data && data.products.length > 0 && (
            <div className="pb-2">
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">Products</p>
              {data.products.map((p) => (
                <button key={p.id} type="button" className={itemClass} onClick={() => go('/catalog')}>
                  <Package className="w-4 h-4 text-[#1B7A4A] dark:text-[#25D366] shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{p.name}</span>
                  </span>
                  <span className="text-sm font-bold">{formatINR(Number(p.price))}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
