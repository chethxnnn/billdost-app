'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, PhoneCall } from 'lucide-react'
import { btnGhost } from '@/components/ui'

export const CALL_OUTCOME_LABELS: Record<string, string> = {
  answered: 'Answered',
  no_answer: 'No answer',
  busy: 'Busy',
  callback_requested: 'Callback requested',
  not_interested: 'Not interested',
  converted: 'Converted',
  other: 'Other',
}

const OUTCOMES = Object.keys(CALL_OUTCOME_LABELS)

/**
 * One-tap call logging: tap Log call, tap the outcome, save. The
 * note is optional and stays internal. Feeds Team stats and the
 * activity timeline through /api/call-logs.
 */
export default function CallLogForm({
  requestId,
  shopId,
}: {
  requestId?: string
  shopId?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState('answered')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/call-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId ?? null,
          shop_id: shopId ?? null,
          outcome,
          note,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not save the call.')
        setBusy(false)
        return
      }
      setSaved(true)
      setNote('')
      setTimeout(() => {
        setOpen(false)
        setSaved(false)
      }, 900)
      router.refresh()
    } catch {
      setError('Could not save the call. Try again.')
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnGhost}>
        <PhoneCall className="w-4 h-4" /> Log call
      </button>
    )
  }

  return (
    <div className="w-full mt-1 p-4 rounded-[16px] bg-black/[0.03] dark:bg-white/[0.05]">
      <p className="text-[13px] font-bold mb-2.5">How did the call go?</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {OUTCOMES.map((o) => (
          <button
            key={o}
            onClick={() => setOutcome(o)}
            aria-pressed={outcome === o}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-all duration-150 active:scale-[0.97] ${
              outcome === o
                ? 'bg-[#1B7A4A] text-white dark:bg-[#25D366] dark:text-black'
                : 'bg-white dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/10'
            }`}
          >
            {CALL_OUTCOME_LABELS[o]}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional, internal)"
          className="flex-1 px-3.5 py-2.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-full text-[13px] font-medium outline-none focus:border-[#1B7A4A] focus:ring-4 focus:ring-[#1B7A4A]/10"
        />
        <button
          disabled={busy}
          onClick={save}
          className="px-4 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-bold rounded-full transition-all inline-flex items-center gap-1.5"
        >
          {saved ? <Check className="w-4 h-4" /> : null}
          {busy ? 'Saving...' : saved ? 'Logged' : 'Save call log'}
        </button>
        <button disabled={busy} onClick={() => setOpen(false)} className="px-3 py-2.5 text-[13px] font-bold">
          Cancel
        </button>
      </div>
      {error ? <p className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  )
}
