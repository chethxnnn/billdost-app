'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar, Card, Pill } from '@/components/ui'
import { ROLE_LABELS, type AdminRole } from '@/lib/roles'
import { describeAction } from '@/lib/audit-labels'
import { formatDateTime } from '@/lib/format'
import type { Presence, TodayCounts } from '@/lib/team-stats'

export interface MemberView {
  id: string
  name: string
  email: string
  role: AdminRole
  status: string
  presence: Presence
  doingNow: string | null
  counts: TodayCounts | null
  assignments: { requests: number; shops: number; issues: number }
}

export interface TimelineEntry {
  id: string
  adminId: string | null
  who: string
  action: string
  shopId: string | null
  shopName: string
  reason: string | null
  created_at: string
}

/**
 * The Team screen (real data, Nov 22): the directory with presence
 * and what each person is doing right now, today's counts from the
 * audit log and call logs, assignment loads, and the full activity
 * timeline as plain sentences, filterable by member. Founders see
 * everyone's counts; everyone else sees the directory, the loads,
 * and only their own counts.
 */
export default function TeamBoard({
  members,
  timeline,
  currentAdminId,
}: {
  members: MemberView[]
  timeline: TimelineEntry[]
  currentAdminId: string
}) {
  const [filter, setFilter] = useState<string>('all')
  const visibleTimeline =
    filter === 'all' ? timeline : timeline.filter((e) => e.adminId === filter)

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
          {members.map((m) => (
            <li key={m.id} className="px-4 md:px-5 py-4">
              <div className="flex items-start gap-3">
                <Avatar
                  name={m.name}
                  size={44}
                  presence={
                    m.presence.state === 'active'
                      ? 'active'
                      : m.presence.state === 'away'
                        ? 'away'
                        : null
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[15px]">
                      {m.name}
                      {m.id === currentAdminId ? (
                        <span className="text-[#86868B] font-medium"> (you)</span>
                      ) : null}
                    </p>
                    <Pill tone={m.status === 'active' ? 'green' : 'red'}>
                      {m.status === 'active' ? ROLE_LABELS[m.role] : 'Disabled'}
                    </Pill>
                  </div>
                  <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium truncate">
                    {m.email}
                  </p>
                  <p className="text-[13px] font-semibold mt-1">
                    {m.doingNow ? (
                      <span className="text-[#14663C] dark:text-[#25D366]">{m.doingNow}</span>
                    ) : (
                      <span className="text-[#5A5A5E] dark:text-[#A1A1A6]">{m.presence.label}</span>
                    )}
                    {m.doingNow ? (
                      <span className="text-[#86868B] font-medium"> · {m.presence.label}</span>
                    ) : null}
                  </p>
                  <p className="text-[12px] font-medium text-[#86868B] mt-1">
                    {m.assignments.requests} open request{m.assignments.requests === 1 ? '' : 's'} ·{' '}
                    {m.assignments.shops} shop{m.assignments.shops === 1 ? '' : 's'} supported ·{' '}
                    {m.assignments.issues} open issue{m.assignments.issues === 1 ? '' : 's'}
                  </p>
                </div>
                {m.counts ? (
                  <div className="hidden md:grid grid-cols-4 gap-4 text-right shrink-0">
                    {(
                      [
                        ['Setups', m.counts.shopsSetup],
                        ['Calls', m.counts.callsLogged],
                        ['Issues done', m.counts.issuesResolved],
                        ['Links', m.counts.linksSent],
                      ] as [string, number][]
                    ).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[20px] font-extrabold tabular-nums leading-none">{value}</p>
                        <p className="text-[11px] font-semibold text-[#86868B] mt-1">{label} today</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hidden md:block text-[12px] font-medium text-[#86868B] shrink-0 max-w-[150px] text-right">
                    Counts are visible to founders, and to each member for themselves.
                  </p>
                )}
              </div>
              {m.counts ? (
                <div className="grid grid-cols-4 gap-3 mt-3 md:hidden">
                  {(
                    [
                      ['Setups', m.counts.shopsSetup],
                      ['Calls', m.counts.callsLogged],
                      ['Issues done', m.counts.issuesResolved],
                      ['Links', m.counts.linksSent],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div key={label} className="bg-black/[0.03] dark:bg-white/[0.05] rounded-[12px] px-3 py-2">
                      <p className="text-[17px] font-extrabold tabular-nums leading-none">{value}</p>
                      <p className="text-[11px] font-semibold text-[#86868B] mt-1">{label} today</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.07]">
          <h2 className="text-[16px] font-bold flex-1">Activity timeline</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-full text-[13px] font-bold outline-none"
            aria-label="Filter timeline by member"
          >
            <option value="all">Everyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {visibleTimeline.length === 0 ? (
          <p className="px-5 py-8 text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
            No activity recorded yet for this view.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
            {visibleTimeline.map((e) => (
              <li key={e.id} className="px-4 md:px-5 py-3 flex items-start gap-3">
                <Avatar name={e.who} size={32} />
                <div className="flex-1 min-w-0 text-[14px] font-medium leading-relaxed">
                  <span className="font-bold">{e.who}</span> {describeAction(e.action)}{' '}
                  {e.shopName ? (
                    e.shopId ? (
                      <Link
                        href={`/shops/${e.shopId}`}
                        className="font-semibold text-[#1B7A4A] dark:text-[#25D366] hover:underline underline-offset-4"
                      >
                        {e.shopName}
                      </Link>
                    ) : (
                      <span className="font-semibold">{e.shopName}</span>
                    )
                  ) : null}
                  {e.reason ? (
                    <span className="text-[#5A5A5E] dark:text-[#A1A1A6]"> · {e.reason}</span>
                  ) : null}
                  <span className="block text-[12px] text-[#86868B] mt-0.5">
                    {formatDateTime(e.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
