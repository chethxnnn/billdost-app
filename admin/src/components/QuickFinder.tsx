'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Store, Inbox, Bug, X } from 'lucide-react'

interface SearchResults {
  shops: { id: string; name: string; status: string; phone: string | null }[]
  requests: { id: string; shop_name: string; status: string; whatsapp_number: string }[]
  issues: { digest: string; title: string; count: number }[]
}

/**
 * Cmd+K quick finder (plan Section 7): type a shop name, owner, phone,
 * request or issue and jump straight to it. On mobile it opens as a
 * full-screen sheet from the search button in the top bar.
 */
export default function QuickFinder() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openFinder = useCallback(() => {
    setQuery('')
    setResults(null)
    setOpen(true)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) setOpen(false)
        else openFinder()
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, openFinder])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open ])

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) {
      setResults(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        if (res.ok) setResults((await res.json()) as SearchResults)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 200)
  }, [])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const hasResults =
    results &&
    (results.shops.length > 0 || results.requests.length > 0 || results.issues.length > 0)

  return (
    <>
      <button
        onClick={openFinder}
        className="flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-full bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-[#5A5A5E] dark:text-[#A1A1A6] transition-colors duration-200 min-w-[44px]"
        aria-label="Search shops, requests and issues"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline text-[13px] font-medium">Search</span>
        <kbd className="hidden md:inline text-[11px] font-semibold bg-white dark:bg-white/10 border border-black/[0.06] dark:border-white/10 rounded-md px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] fade-in flex items-start justify-center p-4 pt-[10vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="pop-in w-full max-w-xl bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <Search className="w-5 h-5 text-[#5A5A5E] dark:text-[#A1A1A6]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  search(e.target.value)
                }}
                placeholder="Shop name, owner, phone, request, issue..."
                className="flex-1 bg-transparent outline-none text-[16px] font-medium placeholder:text-[#86868B]"
              />
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {loading ? (
                <p className="px-4 py-6 text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
                  Searching...
                </p>
              ) : null}
              {!loading && query.trim().length >= 2 && !hasResults ? (
                <p className="px-4 py-6 text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
                  Nothing found for &quot;{query}&quot;.
                </p>
              ) : null}
              {results?.shops.map((s) => (
                <button
                  key={s.id}
                  onClick={() => go(`/shops/${s.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left transition-colors"
                >
                  <Store className="w-4 h-4 text-[#1B7A4A] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-[15px] truncate">{s.name}</span>
                    <span className="block text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6]">
                      Shop{s.phone ? ` · ${s.phone}` : ''}
                    </span>
                  </span>
                </button>
              ))}
              {results?.requests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => go(`/applications/${r.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left transition-colors"
                >
                  <Inbox className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-[15px] truncate">{r.shop_name}</span>
                    <span className="block text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6]">
                      Request · {r.whatsapp_number}
                    </span>
                  </span>
                </button>
              ))}
              {results?.issues.map((i) => (
                <button
                  key={i.digest}
                  onClick={() => go(`/issues?digest=${encodeURIComponent(i.digest)}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-left transition-colors"
                >
                  <Bug className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-[15px] truncate">{i.title}</span>
                    <span className="block text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6]">
                      Issue · {i.count} reports
                    </span>
                  </span>
                </button>
              ))}
              {query.trim().length < 2 ? (
                <p className="px-4 py-6 text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
                  Start typing to find a shop, a request or an issue.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
