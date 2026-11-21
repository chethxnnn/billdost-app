'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone, MessageCircle } from 'lucide-react'
import { btnDanger, btnGhost, btnPrimary } from '@/components/ui'
import { telLink, whatsappLink } from '@/lib/format'

/**
 * The action bar on a request (plan Sections 3 and 6B): Call first,
 * then mark Called, Approve, or Reject with a reason. Setup appears
 * only once a request is approved, and it carries every detail into
 * the setup form.
 */
export default function RequestActions({
  request,
}: {
  request: {
    id: string
    status: string
    whatsapp_number: string
    converted_shop_id: string | null
  }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  async function move(status: string, rejectionReason?: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejection_reason: rejectionReason }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not save. Try again.')
        setBusy(false)
        return
      }
      router.refresh()
    } catch {
      setError('Could not save. Check your connection and try again.')
    }
    setBusy(false)
  }

  const s = request.status

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <a href={telLink(request.whatsapp_number)} className={btnPrimary}>
          <Phone className="w-4 h-4" /> Call the shop
        </a>
        <a
          href={whatsappLink(request.whatsapp_number)}
          target="_blank"
          rel="noreferrer"
          className={btnGhost}
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>

        {(s === 'new' || s === 'called') && (
          <>
            {s === 'new' ? (
              <button disabled={busy} onClick={() => move('called')} className={btnGhost}>
                Mark called
              </button>
            ) : null}
            <button disabled={busy} onClick={() => move('approved')} className={btnGhost}>
              Approve
            </button>
            <button disabled={busy} onClick={() => setRejecting((v) => !v)} className={btnDanger}>
              Reject
            </button>
          </>
        )}

        {s === 'approved' && (
          <Link href={`/shops/new?request=${request.id}`} className={btnPrimary}>
            Set up shop
          </Link>
        )}

        {(s === 'setup_done' || s === 'activation_sent' || s === 'live') &&
        request.converted_shop_id ? (
          <Link href={`/shops/${request.converted_shop_id}`} className={btnPrimary}>
            Open the shop
          </Link>
        ) : null}
      </div>

      {rejecting ? (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Short reason (internal only, never sent to the shop)"
            className="flex-1 px-4 py-3 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[14px] outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10"
          />
          <button
            disabled={busy || !reason.trim()}
            onClick={() => move('rejected', reason)}
            className={btnDanger}
          >
            Confirm rejection
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-[14px] font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  )
}
