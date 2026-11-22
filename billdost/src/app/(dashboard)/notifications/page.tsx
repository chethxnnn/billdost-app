'use client'

import { useEffect, useRef } from 'react'
import { Megaphone } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'abhi abhi'
  if (mins < 60) return `${mins}m pehle`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h pehle`
  return `${Math.floor(hrs / 24)}d pehle`
}

/**
 * Notifications: every platform announcement aimed at this shop,
 * newest first (fix round, Stage 2). Opening the page marks them
 * all seen for the shop, which clears the bell badge and the
 * dashboard banner.
 */
export default function NotificationsPage() {
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.announcements.list.useQuery(undefined, {
    staleTime: 30_000,
  })
  const markSeen = trpc.announcements.markSeen.useMutation({
    onSettled: () => {
      void utils.announcements.list.invalidate()
      void utils.announcements.unseenCount.invalidate()
    },
  })
  const markedRef = useRef(false)

  useEffect(() => {
    if (markedRef.current) return
    if (data && data.some((a) => !a.seen)) {
      markedRef.current = true
      markSeen.mutate({})
    }
  }, [data, markSeen])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight leading-none">
          Notifications
        </h1>
        <p className="text-[14px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-2">
          BillDost team ki announcements, sirf aapki dukaan ke liye.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-[20px] bg-gray-100 dark:bg-[#1C1C1E] animate-pulse"
            />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[20px] p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-[16px] bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#6E6E73] dark:text-[#98989D]">
            <Megaphone className="w-6 h-6" aria-hidden="true" />
          </div>
          <p className="text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-4">
            Abhi koi announcement nahi hai
          </p>
          <p className="text-[13.5px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-1">
            Jab BillDost team kuch bhejegi, woh yahan dikhega.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <article
              key={a.id}
              className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[20px] p-5"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-[14px] bg-[#1B7A4A]/10 dark:bg-[#25D366]/15 text-[#1B7A4A] dark:text-[#25D366] flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[15.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">
                      {a.title}
                    </h2>
                    {!a.seen ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#1B7A4A] dark:text-[#25D366]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1B7A4A] dark:bg-[#25D366]" />
                        Naya
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[14px] font-medium text-[#3A3A3C] dark:text-[#D1D1D6] leading-relaxed mt-1.5 whitespace-pre-line">
                    {a.body}
                  </p>
                  <p className="text-[12px] font-medium text-[#86868B] tabular-nums mt-2.5">
                    {timeAgo(a.created_at)}
                    {a.ends_at
                      ? ` · ${new Date(a.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} tak`
                      : ''}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
