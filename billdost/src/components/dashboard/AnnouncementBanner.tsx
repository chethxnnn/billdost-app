'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Megaphone, X } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

/**
 * Dashboard banner for the newest unseen platform announcement
 * (fix round, Stage 2). Calm by design: one announcement at a time,
 * dismissing marks it seen for the whole shop, and "Sab dekho" leads
 * to the full notifications list. Renders nothing when there is no
 * unseen announcement, so the dashboard stays exactly as it was.
 */
export default function AnnouncementBanner() {
  const utils = trpc.useUtils()
  const { data } = trpc.announcements.list.useQuery(undefined, {
    staleTime: 60_000,
  })
  const markSeen = trpc.announcements.markSeen.useMutation({
    onSettled: () => {
      void utils.announcements.list.invalidate()
      void utils.announcements.unseenCount.invalidate()
    },
  })
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  const latest = (data ?? []).find((a) => !a.seen)
  if (!latest || latest.id === dismissedId) return null

  const dismiss = () => {
    setDismissedId(latest.id)
    markSeen.mutate({ ids: [latest.id] })
  }

  return (
    <div className="flex items-start gap-3.5 bg-[#1B7A4A]/[0.07] dark:bg-[#25D366]/[0.09] border border-[#1B7A4A]/15 dark:border-[#25D366]/20 rounded-[20px] px-5 py-4">
      <div className="w-10 h-10 rounded-[14px] bg-[#1B7A4A] dark:bg-[#25D366] text-white dark:text-black flex items-center justify-center shrink-0">
        <Megaphone className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#1B7A4A] dark:text-[#25D366]">
          BillDost ki taraf se
        </p>
        <p className="text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug mt-0.5">
          {latest.title}
        </p>
        <p className="text-[13.5px] font-medium text-[#3A3A3C] dark:text-[#D1D1D6] leading-relaxed mt-1 line-clamp-2">
          {latest.body}
        </p>
        <Link
          href="/notifications"
          className="inline-block mt-2 text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366] hover:underline underline-offset-4"
        >
          Sab announcements dekho
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Announcement band karo"
        className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6E73] dark:text-[#98989D] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.94] transition-all shrink-0"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  )
}
