'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Phone, MessageCircle } from 'lucide-react'
import { Card, EmptyState, RequestStatusPill } from '@/components/ui'
import { telLink, timeAgo, whatsappLink } from '@/lib/format'

export interface RequestRow {
  id: string
  shop_name: string
  owner_name: string
  whatsapp_number: string
  category: string
  city: string | null
  approx_products: number | null
  note: string | null
  status: string
  created_at: string
}

const FILTERS = [
  'all',
  'new',
  'called',
  'approved',
  'setup_done',
  'activation_sent',
  'live',
  'rejected',
] as const

const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  new: 'New',
  called: 'Called',
  approved: 'Approved',
  setup_done: 'Setup done',
  activation_sent: 'Activation sent',
  live: 'Live',
  rejected: 'Rejected',
}

export default function RequestsBoard({
  requests,
  initialStatus,
}: {
  requests: RequestRow[]
  initialStatus?: string
}) {
  const [status, setStatus] = useState<string>(
    initialStatus && FILTERS.includes(initialStatus as (typeof FILTERS)[number])
      ? initialStatus
      : 'all'
  )
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of requests) map.set(r.status, (map.get(r.status) ?? 0) + 1)
    return map
  }, [requests])

  const visible = requests.filter((r) => {
    if (status !== 'all' && r.status !== status) return false
    if (query) {
      const q = query.toLowerCase()
      return (
        r.shop_name.toLowerCase().includes(q) ||
        r.owner_name.toLowerCase().includes(q) ||
        r.whatsapp_number.includes(q)
      )
    }
    return true
  })

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatus(f)}
            className={`px-3.5 py-2 rounded-full text-[13px] font-bold transition-colors duration-200 ${
              status === f
                ? 'bg-[#1D1D1F] text-white dark:bg-white dark:text-black'
                : 'bg-black/[0.04] dark:bg-white/[0.07] text-[#3A3A3C] dark:text-[#D1D1D6] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
            }`}
          >
            {FILTER_LABELS[f]}
            {f !== 'all' && counts.get(f) ? (
              <span className="ml-1.5 tabular-nums opacity-70">{counts.get(f)}</span>
            ) : null}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by shop, owner or phone"
        className="w-full px-4 py-3 mb-4 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-[15px] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 transition-all"
      />

      {visible.length === 0 ? (
        <EmptyState
          title={requests.length === 0 ? 'No requests yet' : 'Nothing in this view'}
          body={
            requests.length === 0
              ? 'Share the BillDost link to get your next shop. Requests from the website form will land here.'
              : 'Try another status or clear the search.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.id} className="p-4 md:p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/applications/${r.id}`}
                      className="text-[17px] font-bold hover:underline underline-offset-4"
                    >
                      {r.shop_name}
                    </Link>
                    <RequestStatusPill status={r.status} />
                  </div>
                  <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-1">
                    {r.owner_name} · {r.category}
                    {r.city ? ` · ${r.city}` : ''}
                    {r.approx_products ? ` · about ${r.approx_products} products` : ''}
                  </p>
                  {r.note ? (
                    <p className="text-[14px] font-medium mt-1.5 leading-relaxed">
                      &ldquo;{r.note}&rdquo;
                    </p>
                  ) : null}
                  <p className="text-[12px] text-[#86868B] font-medium mt-1.5">
                    Received {timeAgo(r.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={telLink(r.whatsapp_number)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1B7A4A] text-white text-[13px] font-bold active:scale-[0.98] transition-transform"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                  <a
                    href={whatsappLink(r.whatsapp_number)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[13px] font-bold active:scale-[0.98] transition-transform"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
