'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { KanbanSquare, List, Phone, MessageCircle, Play } from 'lucide-react'
import { Avatar, Card, EmptyState, RequestStatusPill } from '@/components/ui'
import AssignControl, { type MemberOption } from '@/components/AssignControl'
import { usePersistedView } from '@/lib/use-persisted-view'
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
  assignee_id: string | null
  claimed_at: string | null
  started_at: string | null
  converted_shop_id: string | null
  shop_status: string | null
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

type Stage = 'requested' | 'called' | 'setup' | 'approval' | 'linksent' | 'live'

const STAGES: { key: Stage; label: string; tone: 'blue' | 'neutral' | 'green' | 'amber' | 'purple' | 'teal' }[] = [
  { key: 'requested', label: 'Requested', tone: 'blue' },
  { key: 'called', label: 'Called', tone: 'neutral' },
  { key: 'setup', label: 'Setup', tone: 'teal' },
  { key: 'approval', label: 'Awaiting approval', tone: 'amber' },
  { key: 'linksent', label: 'Link sent', tone: 'purple' },
  { key: 'live', label: 'Live', tone: 'green' },
]

/**
 * Which board column a request sits in. A setup_done request whose
 * shop is waiting on the founder gets its own column: the approval
 * gate is a stage of the pipeline, not a footnote.
 */
export function stageOf(r: Pick<RequestRow, 'status' | 'shop_status'>): Stage | null {
  switch (r.status) {
    case 'new':
      return 'requested'
    case 'called':
      return 'called'
    case 'approved':
      return 'setup'
    case 'setup_done':
      return r.shop_status === 'awaiting_approval' ? 'approval' : 'setup'
    case 'activation_sent':
      return 'linksent'
    case 'live':
      return 'live'
    default:
      return null
  }
}

const VIEW_KEY = 'billdost-pipeline-view'

/**
 * The Pipeline: a board of compact cards by stage, or the same
 * requests as grouped list rows. The toggle choice persists. Cards
 * follow the one card system: fixed leading avatar, shared baselines,
 * trailing values tabular.
 */
export default function RequestsBoard({
  requests,
  initialStatus,
  members,
  currentAdminId,
  canAssign,
}: {
  requests: RequestRow[]
  initialStatus?: string
  members: MemberOption[]
  currentAdminId: string
  canAssign: boolean
}) {
  const [status, setStatus] = useState<string>(
    initialStatus && FILTERS.includes(initialStatus as (typeof FILTERS)[number])
      ? initialStatus
      : 'all'
  )
  const [query, setQuery] = useState('')
  const [view, chooseView] = usePersistedView<'board' | 'list'>(VIEW_KEY, 'board', [
    'board',
    'list',
  ])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of requests) map.set(r.status, (map.get(r.status) ?? 0) + 1)
    return map
  }, [requests])

  const searched = requests.filter((r) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      r.shop_name.toLowerCase().includes(q) ||
      r.owner_name.toLowerCase().includes(q) ||
      r.whatsapp_number.includes(q)
    )
  })
  const visible = searched.filter((r) => status === 'all' || r.status === status)

  const memberName = (id: string | null) =>
    members.find((m) => m.id === id)?.name ?? null

  const viewToggle = (
    <div className="flex gap-1 p-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08] w-fit">
      {(
        [
          { v: 'board' as const, label: 'Board', Icon: KanbanSquare },
          { v: 'list' as const, label: 'List', Icon: List },
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
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-2 flex-1">
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
        {viewToggle}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by shop, owner or phone"
        className="w-full px-4 py-3 mb-4 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-[15px] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 transition-all"
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No requests yet"
          body="Share the BillDost link to get your next shop. Requests from the website form will land here."
        />
      ) : view === 'board' ? (
        <>
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0">
            {STAGES.map((stage) => {
              const cards = searched.filter((r) => stageOf(r) === stage.key)
              return (
                <div key={stage.key} className="w-[248px] shrink-0">
                  <div className="flex items-baseline justify-between px-1 mb-2">
                    <p className="text-[13px] font-extrabold tracking-[-0.01em]">{stage.label}</p>
                    <span className="text-[12px] font-bold text-[#86868B] tabular-nums">{cards.length}</span>
                  </div>
                  <div className="space-y-2">
                    {cards.length === 0 ? (
                      <p className="text-[12px] font-medium text-[#86868B] px-1 py-3">Nothing here.</p>
                    ) : (
                      cards.map((r) => (
                        <div
                          key={r.id}
                          className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[16px] p-3"
                        >
                          <Link
                            href={`/applications/${r.id}`}
                            className="font-bold text-[14px] leading-snug hover:underline underline-offset-4 block"
                          >
                            {r.shop_name}
                          </Link>
                          <p className="text-[12px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] mt-0.5 truncate">
                            {r.owner_name} · {r.category}
                            {r.city ? ` · ${r.city}` : ''}
                          </p>
                          <div className="flex items-center gap-2 mt-2.5">
                            {r.assignee_id ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold min-w-0">
                                <Avatar name={memberName(r.assignee_id) ?? '?'} size={20} />
                                <span className="truncate">
                                  {r.assignee_id === currentAdminId
                                    ? 'You'
                                    : (memberName(r.assignee_id) ?? 'Assigned')}
                                </span>
                                {r.started_at ? (
                                  <span className="inline-flex items-center gap-0.5 text-[#14663C] dark:text-[#25D366]">
                                    <Play className="w-3 h-3" /> working
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-[12px] font-semibold text-[#86868B]">Unassigned</span>
                            )}
                            <span className="flex-1" />
                            <span className="text-[12px] font-medium text-[#86868B] tabular-nums">
                              {timeAgo(r.created_at)}
                            </span>
                            <a
                              href={telLink(r.whatsapp_number)}
                              className="w-7 h-7 rounded-full bg-[#1B7A4A] text-white flex items-center justify-center active:scale-[0.92] transition-transform"
                              aria-label={`Call ${r.shop_name}`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[12px] font-medium text-[#86868B] mt-1">
            Rejected requests appear in the List view. Open a card for assignment, call logs and actions.
          </p>
        </>
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing in this view" body="Try another status or clear the search." />
      ) : (
        <div className="space-y-6">
          {STAGES.map((stage) => {
            const rows = visible.filter((r) => stageOf(r) === stage.key)
            if (rows.length === 0) return null
            return (
              <section key={stage.key}>
                <p className="text-[13px] font-extrabold tracking-[-0.01em] mb-2 px-1">
                  {stage.label}{' '}
                  <span className="text-[#86868B] tabular-nums">{rows.length}</span>
                </p>
                <Card className="overflow-hidden">
                  <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                    {rows.map((r) => (
                      <li key={r.id} className="px-4 md:px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.owner_name} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/applications/${r.id}`}
                                className="text-[15px] font-bold hover:underline underline-offset-4"
                              >
                                {r.shop_name}
                              </Link>
                              <RequestStatusPill status={r.status} />
                              {r.shop_status === 'awaiting_approval' ? (
                                <span className="text-[12px] font-bold text-amber-700 dark:text-amber-300">
                                  Shop awaiting founder approval
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-0.5 truncate">
                              {r.owner_name} · {r.category}
                              {r.city ? ` · ${r.city}` : ''}
                              {r.approx_products ? ` · about ${r.approx_products} products` : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[12px] font-medium text-[#86868B] tabular-nums">
                              {timeAgo(r.created_at)}
                            </p>
                            <div className="flex gap-1.5 mt-1.5 justify-end">
                              <a
                                href={telLink(r.whatsapp_number)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#1B7A4A] text-white text-[12px] font-bold active:scale-[0.97] transition-transform"
                              >
                                <Phone className="w-3 h-3" /> Call
                              </a>
                              <a
                                href={whatsappLink(r.whatsapp_number)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[12px] font-bold active:scale-[0.97] transition-transform"
                              >
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2.5 pl-[52px]">
                          <AssignControl
                            entity="request"
                            id={r.id}
                            assigneeId={r.assignee_id}
                            members={members}
                            currentAdminId={currentAdminId}
                            canAssign={canAssign}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )
          })}
          {visible.some((r) => r.status === 'rejected') ? (
            <section>
              <p className="text-[13px] font-extrabold tracking-[-0.01em] mb-2 px-1">
                Rejected{' '}
                <span className="text-[#86868B] tabular-nums">
                  {visible.filter((r) => r.status === 'rejected').length}
                </span>
              </p>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                  {visible
                    .filter((r) => r.status === 'rejected')
                    .map((r) => (
                      <li key={r.id} className="px-4 md:px-5 py-3.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/applications/${r.id}`}
                            className="text-[15px] font-bold hover:underline underline-offset-4"
                          >
                            {r.shop_name}
                          </Link>
                          <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium truncate">
                            {r.owner_name} · {timeAgo(r.created_at)}
                          </p>
                        </div>
                        <RequestStatusPill status={r.status} />
                      </li>
                    ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
