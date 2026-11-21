'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, RotateCcw, Send } from 'lucide-react'
import { Avatar, Card } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import { CALL_OUTCOME_LABELS } from '@/components/CallLogForm'

export interface ApprovalCall {
  outcome: string
  note: string | null
  adminName: string
  created_at: string
}

/**
 * The founder approval gate, on the shop page. Awaiting approval:
 * the founder sees the shop summary, who prepared it, and the calls
 * logged, then Approves (the shop becomes pending_activation and a
 * link may be released) or Sends it back with a note. Teammates see
 * the honest waiting state instead. Sent back: the note is shown to
 * the preparer, who fixes and marks it ready again.
 */
export default function ApprovalCard({
  shopId,
  shopName,
  status,
  reviewNote,
  reviewedByName,
  reviewedAt,
  preparedByName,
  preparedAt,
  calls,
  canApprove,
  canSetup,
}: {
  shopId: string
  shopName: string
  status: string
  reviewNote: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  preparedByName: string | null
  preparedAt: string | null
  calls: ApprovalCall[]
  canApprove: boolean
  canSetup: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sendingBack, setSendingBack] = useState(false)
  const [note, setNote] = useState('')

  async function act(action: 'approve' | 'send_back' | 'mark_ready') {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/shops/${shopId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not save.')
        setBusy(false)
        return
      }
      router.refresh()
    } catch {
      setError('Could not save. Try again.')
    }
    setBusy(false)
  }

  if (status === 'setup_returned') {
    return (
      <Card className="p-5 md:p-6 mb-4 border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/[0.06]">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 rounded-[12px] bg-[#B3261E]/10 text-[#B3261E] dark:text-[#F0938C] flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-bold">Sent back for changes</h2>
            <p className="text-[14px] font-medium mt-1 leading-relaxed">
              {reviewedByName ? `${reviewedByName} sent this setup back` : 'The founder sent this setup back'}
              {reviewedAt ? ` on ${formatDateTime(reviewedAt)}` : ''}.
            </p>
            {reviewNote ? (
              <p className="text-[14px] font-semibold mt-2 bg-white/70 dark:bg-white/[0.06] rounded-[12px] px-3.5 py-2.5">
                &ldquo;{reviewNote}&rdquo;
              </p>
            ) : null}
            {canSetup ? (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <button
                  disabled={busy}
                  onClick={() => act('mark_ready')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-bold rounded-full transition-all"
                >
                  <Send className="w-4 h-4" />
                  {busy ? 'Saving...' : 'Fixes done, mark ready for review'}
                </button>
                <span className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6]">
                  Fix the note above first, in the shop data or on a fresh call.
                </span>
              </div>
            ) : (
              <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] mt-3">
                Waiting for the preparer to fix this and mark it ready again.
              </p>
            )}
            {error ? <p className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p> : null}
          </div>
        </div>
      </Card>
    )
  }

  // awaiting_approval
  return (
    <Card className="p-5 md:p-6 mb-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/[0.05]">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-[12px] bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center">
          <Clock3 className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold">Waiting for founder approval</h2>
          <p className="text-[14px] font-medium mt-1 leading-relaxed">
            {preparedByName ? (
              <>
                Setup prepared by{' '}
                <span className="inline-flex items-center gap-1.5 font-bold align-middle">
                  <Avatar name={preparedByName} size={20} /> {preparedByName}
                </span>
                {preparedAt ? ` · ${formatDateTime(preparedAt)}` : ''}.{' '}
              </>
            ) : null}
            No activation link exists for {shopName} yet, and none can
            be created until it is approved.
          </p>

          {calls.length > 0 ? (
            <div className="mt-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#86868B] mb-1.5">
                Calls logged
              </p>
              <ul className="space-y-1.5">
                {calls.map((c, i) => (
                  <li key={i} className="text-[13px] font-medium">
                    <span className="font-bold">{CALL_OUTCOME_LABELS[c.outcome] ?? c.outcome}</span>
                    {c.note ? ` · ${c.note}` : ''}{' '}
                    <span className="text-[#86868B]">
                      by {c.adminName} · {formatDateTime(c.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canApprove ? (
            <div className="mt-4">
              {!sendingBack ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={() => act('approve')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] disabled:opacity-50 text-white text-[14px] font-bold rounded-full transition-all shadow-sm shadow-[#1B7A4A]/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {busy ? 'Approving...' : 'Approve and allow activation'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setSendingBack(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-600/30 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-[0.98] text-red-700 dark:text-red-400 text-[14px] font-semibold rounded-full transition-all"
                  >
                    <RotateCcw className="w-4 h-4" /> Send back
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What needs fixing? The preparer sees this."
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-full text-[13px] font-medium outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10"
                  />
                  <button
                    disabled={busy || !note.trim()}
                    onClick={() => act('send_back')}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 text-white text-[13px] font-bold rounded-full transition-all"
                  >
                    {busy ? 'Sending...' : 'Confirm send back'}
                  </button>
                  <button disabled={busy} onClick={() => setSendingBack(false)} className="px-3 py-2.5 text-[13px] font-bold">
                    Cancel
                  </button>
                </div>
              )}
              {error ? <p className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p> : null}
            </div>
          ) : (
            <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] mt-3">
              The founder reviews every setup before activation. This
              shop is in their Today queue now. See the{' '}
              <Link href="/team" className="font-bold text-[#14663C] dark:text-[#25D366] hover:underline underline-offset-4">
                Team screen
              </Link>{' '}
              for who is working on what.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
