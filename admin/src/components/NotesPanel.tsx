'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary } from '@/components/ui'
import { formatDateTime } from '@/lib/format'

export interface SupportNote {
  id: string
  note: string
  created_at: string
  author: string
}

/**
 * Support notes (plan Section 6D): what was said on the call, written
 * before the page closes. The composer stays at the top so the next
 * note never waits for anything.
 */
export default function NotesPanel({
  shopId,
  notes,
  canWrite,
}: {
  shopId: string
  notes: SupportNote[]
  canWrite: boolean
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/shops/${shopId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: text }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not save the note.')
        setBusy(false)
        return
      }
      setText('')
      router.refresh()
    } catch {
      setError('Could not save the note. Try again.')
    }
    setBusy(false)
  }

  return (
    <div>
      {canWrite ? (
        <div className="mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Call note: kya baat hui, kya promise kiya..."
            className="w-full px-4 py-3 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[14px] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 transition-all resize-none"
          />
          {error ? (
            <p className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <button disabled={busy || !text.trim()} onClick={add} className={btnPrimary + ' mt-2'}>
            {busy ? 'Saving...' : 'Add note'}
          </button>
        </div>
      ) : null}
      {notes.length === 0 ? (
        <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
          No notes yet. The first call summary will live here.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-[#1B7A4A]/30 pl-3.5">
              <p className="text-[14px] font-medium leading-relaxed">{n.note}</p>
              <p className="text-[12px] text-[#86868B] font-medium mt-1">
                {n.author} · {formatDateTime(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
