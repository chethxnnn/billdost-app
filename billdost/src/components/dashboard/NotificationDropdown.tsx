'use client'

import { useState, useRef, useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'abhi abhi'
  if (mins < 60) return `${mins}m pehle`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h pehle`
  return `${Math.floor(hrs / 24)}d pehle`
}

const typeLabel: Record<string, string> = {
  invoice_created: '🧾 Naya invoice banaya',
  invoice_sent: '📤 Invoice bheja',
  invoice_paid: '✅ Payment mila',
  quotation_created: '📋 Naya quotation banaya',
  quotation_converted: '🔄 Quotation convert hua',
  customer_added: '👤 Naya customer joda',
  payment_received: '💰 Payment received',
  stock_low: '⚠️ Stock kam hai',
  shop_created: '🏪 Shop create hua',
  settings_changed: '⚙️ Settings badli',
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: activity, isLoading } = trpc.analytics.recentActivity.useQuery(
    { limit: 8 },
    { enabled: open, staleTime: 30_000 }
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleToggle = () => {
    setOpen((prev) => !prev)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell"
        onClick={handleToggle}
        className="relative w-10 h-10 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/10 dark:hover:bg-white/10 transition-all hover:scale-105 flex-shrink-0"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] max-h-[480px] bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Notifications 🔔
            </h3>
            <Link
              href="/activity"
              onClick={() => setOpen(false)}
              className="text-[13px] font-semibold text-[#1B7A4A] dark:text-[#25D366] hover:underline"
            >
              Sab dekho →
            </Link>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[400px]">
            {isLoading ? (
              <div className="p-5 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#2E2C28] flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-gray-200 dark:bg-[#2E2C28] rounded w-4/5" />
                      <div className="h-2.5 bg-gray-200 dark:bg-[#2E2C28] rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !activity || activity.length === 0 ? (
              <div className="p-10 text-center">
                <div className="text-3xl mb-2">🔕</div>
                <p className="text-[14px] text-gray-500 dark:text-[#98989D] font-medium">
                  Koi nai notification nahi hai
                </p>
              </div>
            ) : (
              <div>
                {activity.map((act, index) => (
                  <div
                    key={act.id}
                    className={`flex items-start gap-3 px-5 py-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors cursor-default ${
                      index === 0 ? '' : 'border-t border-black/5 dark:border-white/5'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 flex items-center justify-center text-[14px] flex-shrink-0 mt-0.5">
                      {typeLabel[act.type]?.split(' ')[0] || '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug truncate">
                        {act.summary}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium text-gray-400 dark:text-[#636366]">
                          {typeLabel[act.type]?.slice(typeLabel[act.type].indexOf(' ') + 1) || act.type}
                        </span>
                        <span className="text-[11px] text-gray-300 dark:text-[#48484A]">•</span>
                        <span className="text-[11px] font-bold text-[#1B7A4A] dark:text-[#25D366]">
                          {timeAgo(act.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
