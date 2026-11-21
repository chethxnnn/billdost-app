'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, EmptyState, ShopStatusPill } from '@/components/ui'
import { formatCount, timeAgo } from '@/lib/format'

export interface ShopRow {
  id: string
  name: string
  category: string
  status: string
  plan: string
  ownerName: string
  ownerPhone: string
  bills: number
  lastBillAt: string | null
  createdAt: string
}

function health(shop: ShopRow): { dot: string; word: string } {
  if (shop.status === 'suspended') return { dot: 'bg-red-500', word: 'Suspended' }
  if (shop.status === 'pending_activation') return { dot: 'bg-amber-500', word: 'Waiting' }
  if (!shop.lastBillAt) return { dot: 'bg-amber-500', word: 'No bills yet' }
  const days = (Date.now() - new Date(shop.lastBillAt).getTime()) / 86400000
  if (days <= 3) return { dot: 'bg-[#1B7A4A]', word: 'Active' }
  if (days <= 7) return { dot: 'bg-amber-500', word: 'Slowing' }
  return { dot: 'bg-red-500', word: 'Quiet' }
}

export default function ShopsTable({
  shops,
  initialStatus,
}: {
  shops: ShopRow[]
  initialStatus?: string
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(initialStatus ?? 'all')
  const [category, setCategory] = useState('all')

  const categories = useMemo(
    () => [...new Set(shops.map((s) => s.category))].sort(),
    [shops]
  )

  const visible = shops.filter((s) => {
    if (status !== 'all' && s.status !== status) return false
    if (category !== 'all' && s.category !== category) return false
    if (query) {
      const q = query.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        s.ownerPhone.includes(q)
      )
    }
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by shop, owner or phone"
          className="flex-1 px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-[15px] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 transition-all"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-[14px] font-semibold outline-none"
        >
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="pending_activation">Pending activation</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-[14px] font-semibold outline-none"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={shops.length === 0 ? 'No shops yet' : 'No shops match'}
          body={
            shops.length === 0
              ? 'Approve a request and set up your first shop. It will appear here the moment it is created.'
              : 'Try another search or filter.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_1.2fr_1fr_0.8fr_1fr_1fr] gap-3 px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.07] text-[11px] font-bold uppercase tracking-wide text-[#86868B]">
            <span>Shop</span>
            <span>Owner</span>
            <span>Status</span>
            <span className="text-right">Bills</span>
            <span>Last active</span>
            <span>Health</span>
          </div>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
            {visible.map((s) => {
              const h = health(s)
              return (
                <li key={s.id}>
                  <Link
                    href={`/shops/${s.id}`}
                    className="grid md:grid-cols-[2fr_1.2fr_1fr_0.8fr_1fr_1fr] gap-1.5 md:gap-3 px-5 py-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-[15px] truncate">{s.name}</span>
                      <span className="block text-[12px] text-[#86868B] font-medium md:hidden">
                        {s.category} · {s.ownerPhone}
                      </span>
                      <span className="hidden md:block text-[12px] text-[#86868B] font-medium">
                        {s.category} · {s.plan} plan
                      </span>
                    </span>
                    <span className="hidden md:block min-w-0">
                      <span className="block text-[14px] font-semibold truncate">{s.ownerName}</span>
                      <span className="block text-[12px] text-[#86868B] font-medium">{s.ownerPhone}</span>
                    </span>
                    <span className="hidden md:block">
                      <ShopStatusPill status={s.status} />
                    </span>
                    <span className="hidden md:block text-right text-[15px] font-bold tabular-nums">
                      {formatCount(s.bills)}
                    </span>
                    <span className="hidden md:block text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6]">
                      {s.lastBillAt ? timeAgo(s.lastBillAt) : 'No bills yet'}
                    </span>
                    <span className="hidden md:flex items-center gap-2 text-[13px] font-semibold">
                      <span className={`w-2 h-2 rounded-full ${h.dot}`} />
                      {h.word}
                    </span>
                    <span className="md:hidden flex items-center gap-2">
                      <ShopStatusPill status={s.status} />
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                        <span className={`w-2 h-2 rounded-full ${h.dot}`} />
                        {h.word}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
