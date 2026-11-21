'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, MessageCircle, Link2 } from 'lucide-react'
import { btnGhost, btnPrimary } from '@/components/ui'

/**
 * The activation step (plan Sections 3, 4 and 6C): generate the link,
 * send it on WhatsApp or copy it and send it yourself. Setup is not
 * done when the form saves; it is done when the link is sent. Every
 * generation kills the previous link for this shop, server-side.
 */
export default function ActivationPanel({
  shopId,
  compact = false,
}: {
  shopId: string
  compact?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'whatsapp' | 'manual' | null>(null)
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate(channel: 'whatsapp' | 'manual') {
    setBusy(channel)
    setError('')
    setNote('')
    setCopied(false)
    try {
      const res = await fetch(`/api/shops/${shopId}/activation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not create the link. Try again.')
        setBusy(null)
        return
      }
      setLink(data.link as string)
      if (channel === 'whatsapp') {
        setNote(
          data.whatsapp?.sent
            ? 'Sent on WhatsApp. Stay on the call while they set their password.'
            : (data.whatsapp?.reason ?? 'Copy the link and send it yourself.')
        )
      } else {
        setNote('Link ready. Copy it and send it from your own WhatsApp or SMS.')
      }
      router.refresh()
    } catch {
      setError('Could not create the link. Check your connection and try again.')
    }
    setBusy(null)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed. Long-press the link to copy it manually.')
    }
  }

  return (
    <div>
      {!compact ? (
        <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed mb-4">
          The link works once and expires in 72 hours. Generating a new
          one kills the previous link for this shop.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy !== null}
          onClick={() => generate('whatsapp')}
          className={btnPrimary}
        >
          <MessageCircle className="w-4 h-4" />
          {busy === 'whatsapp' ? 'Sending...' : 'Send activation on WhatsApp'}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => generate('manual')}
          className={btnGhost}
        >
          <Link2 className="w-4 h-4" />
          {busy === 'manual' ? 'Creating...' : 'Get a link to copy'}
        </button>
      </div>

      {link ? (
        <div className="mt-4 flex items-center gap-2 bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl pl-4 pr-2 py-2">
          <span className="flex-1 text-[13px] font-medium truncate">{link}</span>
          <button
            onClick={copyLink}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-white/10 text-[13px] font-bold active:scale-[0.98] transition-transform"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
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
