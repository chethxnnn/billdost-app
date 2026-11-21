'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, Play } from 'lucide-react'
import { Card, IssueStatusPill, Tile } from '@/components/ui'
import AssignControl, { type MemberOption } from '@/components/AssignControl'
import { formatDateTime } from '@/lib/format'

export interface IssueGroup {
  digest: string
  title: string
  message: string
  route: string | null
  count: number
  shopsAffected: number
  shopNames: string[]
  firstSeen: string
  lastSeen: string
  status: string
  note: string | null
  assigneeId: string | null
  startedAt: string | null
  sample: { message: string | null; stack: string | null; appVersion: string | null }
}

const NEXT_STATUS: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'informed', label: 'Informed' },
]

const SEVERITY_TILE: Record<string, 'pink' | 'amber' | 'blue' | 'green'> = {
  new: 'pink',
  investigating: 'amber',
  fixed: 'blue',
  informed: 'green',
}

/**
 * One issue, one severity row (plan Section 6E): how many shops, how
 * often, since when, who owns it, and a status flow that ends at
 * Informed, which means the shops were actually told. Technical
 * detail (stack, digest) stays behind the expand control.
 */
export default function IssueGroupCard({
  group,
  canEdit,
  highlighted,
  members,
  currentAdminId,
  canAssign,
}: {
  group: IssueGroup
  canEdit: boolean
  highlighted?: boolean
  members: MemberOption[]
  currentAdminId: string
  canAssign: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState(group.status)
  const [note, setNote] = useState(group.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/issues/${encodeURIComponent(group.digest)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_status: status, internal_note: note }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not save.')
        setBusy(false)
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Could not save. Try again.')
    }
    setBusy(false)
  }

  async function start() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/issues/${encodeURIComponent(group.digest)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()
      if (!data.ok) setError(data.error ?? 'Could not save.')
      else router.refresh()
    } catch {
      setError('Could not save. Try again.')
    }
    setBusy(false)
  }

  const open = group.status === 'new' || group.status === 'investigating'

  return (
    <Card
      className={`p-4 md:p-5 ${highlighted ? 'ring-2 ring-[#1B7A4A]/50 dark:ring-[#25D366]/50' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Tile tone={SEVERITY_TILE[group.status] ?? 'neutral'}>
          <Bug className="w-5 h-5" />
        </Tile>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-bold">{group.title}</h3>
            <IssueStatusPill status={group.status} />
            {group.startedAt && open ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#14663C] dark:text-[#25D366]">
                <Play className="w-3 h-3" /> In progress
              </span>
            ) : null}
          </div>
          <p className="text-[14px] font-medium mt-1 leading-relaxed break-words">
            {group.message}
          </p>
          <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-2">
            {group.count} reports · {group.shopsAffected} shop{group.shopsAffected === 1 ? '' : 's'} affected
            {group.shopNames.length > 0 ? ` (${group.shopNames.slice(0, 3).join(', ')}${group.shopNames.length > 3 ? '...' : ''})` : ''}
            {group.route ? ` · on ${group.route}` : ''}
          </p>
          <p className="text-[12px] text-[#86868B] font-medium mt-1">
            First seen {formatDateTime(group.firstSeen)} · Last seen {formatDateTime(group.lastSeen)}
          </p>
          <div className="mt-3">
            <AssignControl
              entity="issue"
              id={group.digest}
              assigneeId={group.assigneeId}
              members={members}
              currentAdminId={currentAdminId}
              canAssign={canAssign}
            />
          </div>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-[20px] font-extrabold tabular-nums leading-none">{group.count}</p>
          <p className="text-[12px] font-medium text-[#86868B] mt-1">reports</p>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-[#5A5A5E] dark:text-[#A1A1A6]">
          Technical details
        </summary>
        <div className="mt-2 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl p-3 text-[12px] space-y-1.5 overflow-auto">
          <p><strong>Digest:</strong> {group.digest}</p>
          {group.sample.appVersion ? <p><strong>App version:</strong> {group.sample.appVersion}</p> : null}
          {group.sample.message ? <p className="whitespace-pre-wrap break-words"><strong>Message:</strong> {group.sample.message}</p> : null}
          {group.sample.stack ? <pre className="whitespace-pre-wrap break-words">{group.sample.stack}</pre> : null}
        </div>
      </details>

      {canEdit ? (
        <div className="mt-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.07] flex flex-col sm:flex-row gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3.5 py-2.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-full text-[13px] font-bold outline-none"
          >
            {NEXT_STATUS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note"
            className="flex-1 px-4 py-2.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-full text-[13px] font-medium outline-none focus:border-[#1B7A4A] focus:ring-4 focus:ring-[#1B7A4A]/10"
          />
          {open && !group.startedAt ? (
            <button
              disabled={busy}
              onClick={start}
              className="px-4 py-2.5 bg-black/[0.04] dark:bg-white/[0.08] active:scale-[0.98] disabled:opacity-50 text-[13px] font-bold rounded-full transition-all inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </button>
          ) : null}
          <button
            disabled={busy}
            onClick={save}
            className="px-4 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-bold rounded-full transition-all"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      ) : null}
      {saved ? <p className="mt-2 text-[13px] font-medium text-[#14663C] dark:text-[#25D366]">Saved.</p> : null}
      {error ? <p className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p> : null}
    </Card>
  )
}
