'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui'

export interface MemberOption {
  id: string
  name: string
}

/**
 * Assign / claim control, one shape everywhere (pipeline cards,
 * application detail, shop detail, issue rows): the current owner's
 * avatar and name, an "Assign to me" shortcut, and a member picker.
 * Every change goes through /api/assign, which audit-logs it.
 */
export default function AssignControl({
  entity,
  id,
  assigneeId,
  members,
  currentAdminId,
  canAssign,
  label = 'Owner',
}: {
  entity: 'request' | 'shop' | 'issue'
  id: string
  assigneeId: string | null
  members: MemberOption[]
  currentAdminId: string
  canAssign: boolean
  label?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const assignee = members.find((m) => m.id === assigneeId) ?? null

  async function assign(next: string | null) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, id, assignee_id: next }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not assign.')
        setBusy(false)
        return
      }
      router.refresh()
    } catch {
      setError('Could not assign. Try again.')
    }
    setBusy(false)
  }

  if (!canAssign) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#5A5A5E] dark:text-[#A1A1A6]">
        {assignee ? (
          <>
            <Avatar name={assignee.name} size={24} />
            {assignee.name}
          </>
        ) : (
          'Unassigned'
        )}
      </span>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-bold uppercase tracking-wide text-[#86868B]">{label}</span>
      {assignee ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold">
          <Avatar name={assignee.name} size={24} />
          {assignee.id === currentAdminId ? 'You' : assignee.name}
        </span>
      ) : (
        <span className="text-[13px] font-semibold text-[#86868B]">Unassigned</span>
      )}
      {assigneeId !== currentAdminId ? (
        <button
          disabled={busy}
          onClick={() => assign(currentAdminId)}
          className="px-2.5 py-1 rounded-full bg-[#1B7A4A]/10 text-[#14663C] dark:bg-[#25D366]/15 dark:text-[#25D366] text-[12px] font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          Assign to me
        </button>
      ) : null}
      <select
        disabled={busy}
        value={assigneeId ?? ''}
        onChange={(e) => assign(e.target.value || null)}
        className="px-2 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[12px] font-bold outline-none disabled:opacity-50"
        aria-label="Assign to a team member"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id === currentAdminId ? 'You' : m.name}
          </option>
        ))}
      </select>
      {error ? <span className="text-[12px] font-semibold text-red-600 dark:text-red-400">{error}</span> : null}
    </span>
  )
}
