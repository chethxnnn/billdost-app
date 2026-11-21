'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List, Store } from 'lucide-react'
import { Avatar, Card, EmptyState, ShopStatusPill, Tile } from '@/components/ui'
import { usePersistedView } from '@/lib/use-persisted-view'
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
  supportOwnerId: string | null
  supportOwnerName: string | null
}

function health(shop: ShopRow): { dot: string; word: string } {
  if (shop.status === 'suspended') return { dot: 'bg-red-500', word: 'Suspended' }
  if (shop.status === 'awaiting_approval') return { dot: 'bg-amber-500', word: 'Needs approval' }
  if (shop.status === 'setup_returned') return { dot: 'bg-red-500', word: 'Changes requested' }
  if (shop.status === 'pending_activation') return { dot: 'bg-amber-500', word: 'Waiting' }
  if (!shop.lastBillAt) return { dot: 'bg-amber-500', word: 'No bills yet' }
  const days = (Date.now() - new Date(shop.lastBillAt).getTime()) / 86400000
  if (days <= 3) return { dot: 'bg-[#1B7A4A]', word: 'Active' }
  if (days <= 7) return { dot: 'bg-amber-500', word: 'Slowing' }
  return { dot: 'bg-red-500', word: 'Quiet' }
}

const GROUP_ORDER: { key: string; label: string; statuses: string[] }[] = [
  { key: 'attention', label: 'Needs attention', statuses: ['awaiting_approval', 'setup_returned', 'pending_activation', 'suspended'] },
  { key: 'live', label: 'Live', statuses: ['live'] },
]

const VIEW_KEY = 'billdost-shops-view'

/**
 * Shops: a grouped list (attention first, then live) or a grid of
 * mini cards. One card system in both: fixed leading tile, shared
 * baselines, bills right-aligned in tabular numbers. The toggle
 * choice persists.
 */
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
  const [view, chooseView] = usePersistedView<'list' | 'grid'>(VIEW_KEY, 'list', [
    'list',
    'grid',
  ])

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

  const grouped = GROUP_ORDER.map((g) => ({
    ...g,
    rows: visible.filter((s) => g.statuses.includes(s.status)),
  })).filter((g) => g.rows.length > 0)

  const rowInner = (s: ShopRow) => {
    const h = health(s)
    return (
      <>
        <Tile tone={s.status === 'live' ? 'green' : s.status === 'suspended' || s.status === 'setup_returned' ? 'pink' : 'amber'}>
          <Store className="w-5 h-5" />
        </Tile>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[15px] truncate">{s.name}</span>
            <ShopStatusPill status={s.status} />
          </span>
          <span className="block text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium truncate">
            {s.ownerName || 'Owner not recorded'}
            {s.ownerPhone ? ` · ${s.ownerPhone}` : ''} · {s.category} · {s.plan} plan
          </span>
          {s.supportOwnerName ? (
            <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A5A5E] dark:text-[#A1A1A6]">
              <Avatar name={s.supportOwnerName} size={18} /> Support: {s.supportOwnerName}
            </span>
          ) : null}
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[15px] font-extrabold tabular-nums">{formatCount(s.bills)}</span>
          <span className="block text-[12px] font-medium text-[#86868B]">bills</span>
        </span>
        <span className="hidden sm:block w-[130px] shrink-0">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <span className={`w-2 h-2 rounded-full ${h.dot}`} />
            {h.word}
          </span>
          <span className="block text-[12px] font-medium text-[#86868B] mt-0.5">
            {s.lastBillAt ? `Last bill ${timeAgo(s.lastBillAt)}` : 'No bills yet'}
          </span>
        </span>
      </>
    )
  }

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
          <option value="awaiting_approval">Awaiting approval</option>
          <option value="setup_returned">Changes requested</option>
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
        <div className="flex gap-1 p-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08] w-fit self-start">
          {(
            [
              { v: 'list' as const, label: 'List', Icon: List },
              { v: 'grid' as const, label: 'Grid', Icon: LayoutGrid },
            ]
          ).map(({ v, label, Icon }) => (
            <button
              key={v}
              onClick={() => chooseView(v)}
              aria-pressed={view === v}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 active:scale-[0.97] ${
                view === v
                  ? 'bg-white dark:bg-[#3A3A3C] shadow-sm'
                  : 'text-[#5A5A5E] dark:text-[#A1A1A6]'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
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
      ) : view === 'list' ? (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.key}>
              <p className="text-[13px] font-extrabold tracking-[-0.01em] mb-2 px-1">
                {g.label} <span className="text-[#86868B] tabular-nums">{g.rows.length}</span>
              </p>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                  {g.rows.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/shops/${s.id}`}
                        className="flex items-center gap-3 px-4 md:px-5 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                      >
                        {rowInner(s)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((s) => {
            const h = health(s)
            return (
              <Link key={s.id} href={`/shops/${s.id}`} className="block">
                <Card className="p-4 h-full hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-start gap-3">
                    <Tile tone={s.status === 'live' ? 'green' : s.status === 'suspended' || s.status === 'setup_returned' ? 'pink' : 'amber'}>
                      <Store className="w-5 h-5" />
                    </Tile>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[15px] truncate">{s.name}</p>
                      <p className="text-[12px] font-medium text-[#86868B] truncate">
                        {s.category} · {s.plan} plan
                      </p>
                    </div>
                    <ShopStatusPill status={s.status} />
                  </div>
                  <div className="flex items-end justify-between mt-4">
                    <div>
                      <p className="text-[20px] font-extrabold tabular-nums leading-none">
                        {formatCount(s.bills)}
                      </p>
                      <p className="text-[12px] font-medium text-[#86868B] mt-1">bills</p>
                    </div>
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                      <span className={`w-2 h-2 rounded-full ${h.dot}`} />
                      {h.word}
                    </p>
                  </div>
                  <p className="text-[12px] font-medium text-[#86868B] mt-3 truncate">
                    {s.ownerName || 'Owner not recorded'}
                    {s.lastBillAt ? ` · last bill ${timeAgo(s.lastBillAt)}` : ' · no bills yet'}
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
