'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { btnGhost } from '@/components/ui'

/**
 * Start work on a request: stamps started_at through the requests
 * API, so the Team screen can honestly show who is doing what right
 * now. Advancing the pipeline clears the stamp again.
 */
export default function StartWorkButton({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function start() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
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

  return (
    <span className="inline-flex items-center gap-2">
      <button disabled={busy} onClick={start} className={btnGhost}>
        <Play className="w-4 h-4" /> {busy ? 'Starting...' : 'Start work'}
      </button>
      {error ? <span className="text-[13px] font-medium text-red-600 dark:text-red-400">{error}</span> : null}
    </span>
  )
}
