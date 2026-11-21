'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BellRing,
  Bug,
  CheckCircle2,
  Clock3,
  PhoneCall,
  Store,
  Timer,
  Wallet,
} from 'lucide-react'
import { Tile } from '@/components/ui'
import type { AttentionItem, AttentionKind } from '@/lib/attention'

const KIND_ICON: Record<AttentionKind, typeof BellRing> = {
  shop_approval: CheckCircle2,
  new_request_unassigned: PhoneCall,
  called_no_followup: PhoneCall,
  token_expiring: Timer,
  activation_waiting: Clock3,
  issue_open: Bug,
  shop_quiet: Store,
  plan_overdue: Wallet,
}

const KIND_TONE: Record<AttentionKind, 'green' | 'amber' | 'pink' | 'blue' | 'purple' | 'neutral'> = {
  shop_approval: 'amber',
  new_request_unassigned: 'blue',
  called_no_followup: 'blue',
  token_expiring: 'pink',
  activation_waiting: 'amber',
  issue_open: 'pink',
  shop_quiet: 'neutral',
  plan_overdue: 'amber',
}

/**
 * The Today action queue: attention items ranked by the engine,
 * each one a row in the card system with its primary action inline.
 * Unassigned requests can be claimed right here; everything else
 * jumps straight to the screen that finishes the job.
 */
export default function AttentionQueue({
  items,
  currentAdminId,
  canAssign,
}: {
  items: AttentionItem[]
  currentAdminId: string
  canAssign: boolean
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [claimed, setClaimed] = useState<Set<string>>(new Set())

  async function claim(requestId: string) {
    setBusyId(requestId)
    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'request', id: requestId, assignee_id: currentAdminId }),
      })
      const data = await res.json()
      if (data.ok) {
        setClaimed((prev) => new Set(prev).add(requestId))
        router.refresh()
      }
    } catch {
      // The row stays; the founder sees the truth on refresh.
    }
    setBusyId(null)
  }

  if (items.length === 0) {
    return (
      <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed">
        Nothing needs you right now. New requests, expiring links and
        quiet shops will appear here the moment they need attention.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
      {items.map((item, i) => {
        const Icon = KIND_ICON[item.kind]
        const isClaimed = item.requestId ? claimed.has(item.requestId) : false
        return (
          <li key={`${item.kind}-${i}`} className="py-3 flex items-center gap-3">
            <Tile tone={KIND_TONE[item.kind]}>
              <Icon className="w-5 h-5" />
            </Tile>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[14px] leading-snug">{item.title}</p>
              <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] leading-snug mt-0.5">
                {item.meta}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.kind === 'new_request_unassigned' && item.requestId && canAssign ? (
                <button
                  disabled={busyId === item.requestId || isClaimed}
                  onClick={() => claim(item.requestId!)}
                  className="px-3.5 py-2 rounded-full bg-[#1B7A4A]/10 text-[#14663C] dark:bg-[#25D366]/15 dark:text-[#25D366] text-[13px] font-bold active:scale-[0.97] transition-transform disabled:opacity-60"
                >
                  {isClaimed ? 'Assigned to you' : busyId === item.requestId ? 'Assigning...' : 'Assign to me'}
                </button>
              ) : null}
              <Link
                href={item.href}
                className="px-3.5 py-2 rounded-full bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-[13px] font-bold active:scale-[0.97] transition-all"
              >
                {item.actionLabel}
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
