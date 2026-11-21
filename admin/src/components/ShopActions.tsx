'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, PauseCircle, PlayCircle } from 'lucide-react'
import { btnDanger, btnGhost } from '@/components/ui'

/**
 * Account actions on a shop (plan Sections 3 and 6D): password reset
 * link, suspend and reactivate, each with a reason where the plan
 * demands one, each audit-logged on the server. There is deliberately
 * no edit-shop-data action here: business data changes happen inside
 * the shop, by the shop.
 */
export default function ShopActions({
  shopId,
  shopStatus,
  canSuspend,
  canAccount,
}: {
  shopId: string
  shopStatus: string
  canSuspend: boolean
  canAccount: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [resetLink, setResetLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState<'suspend' | 'reactivate' | null>(null)
  const [reason, setReason] = useState('')

  async function createResetLink() {
    setBusy(true)
    setError('')
    setNote('')
    try {
      const res = await fetch(`/api/shops/${shopId}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not create the link.')
      } else {
        setResetLink(data.link as string)
        setNote('Reset link created. Send it to the owner yourself; it is shown only here.')
      }
    } catch {
      setError('Could not create the link. Try again.')
    }
    setBusy(false)
  }

  async function changeStatus(action: 'suspend' | 'reactivate') {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/shops/${shopId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not save.')
        setBusy(false)
        return
      }
      setConfirming(null)
      setReason('')
      router.refresh()
    } catch {
      setError('Could not save. Try again.')
    }
    setBusy(false)
  }

  async function copyReset() {
    try {
      await navigator.clipboard.writeText(resetLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed. Long-press the link to copy it.')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canAccount && shopStatus === 'live' ? (
          <button disabled={busy} onClick={createResetLink} className={btnGhost}>
            <KeyRound className="w-4 h-4" /> Password reset link
          </button>
        ) : null}
        {canSuspend && shopStatus === 'live' ? (
          <button disabled={busy} onClick={() => setConfirming('suspend')} className={btnDanger}>
            <PauseCircle className="w-4 h-4" /> Suspend shop
          </button>
        ) : null}
        {canSuspend && shopStatus === 'suspended' ? (
          <button disabled={busy} onClick={() => setConfirming('reactivate')} className={btnGhost}>
            <PlayCircle className="w-4 h-4" /> Reactivate shop
          </button>
        ) : null}
      </div>

      {resetLink ? (
        <div className="mt-4 flex items-center gap-2 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl pl-4 pr-2 py-2">
          <span className="flex-1 text-[13px] font-medium truncate">{resetLink}</span>
          <button
            onClick={copyReset}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-white/10 text-[13px] font-bold active:scale-[0.98] transition-transform"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : null}

      {confirming ? (
        <div className="mt-4">
          <p className="text-[14px] font-semibold mb-2">
            {confirming === 'suspend'
              ? 'Suspend this shop? Logins stop today; every byte of data stays untouched.'
              : 'Reactivate this shop? Access returns exactly as it was.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required, goes to the audit log)"
              className="flex-1 px-4 py-3 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[14px] outline-none focus:border-[#1B7A4A] focus:ring-4 focus:ring-[#1B7A4A]/10"
            />
            <button
              disabled={busy || !reason.trim()}
              onClick={() => changeStatus(confirming)}
              className={confirming === 'suspend' ? btnDanger : btnGhost}
            >
              {busy ? 'Saving...' : confirming === 'suspend' ? 'Confirm suspend' : 'Confirm reactivate'}
            </button>
            <button disabled={busy} onClick={() => setConfirming(null)} className={btnGhost}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {note ? (
        <p className="mt-3 text-[14px] font-medium text-[#14663C] dark:text-[#25D366]">{note}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-[14px] font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  )
}
