'use client'

import { ArrowUpRight, ArrowDownRight, Package, Users, Receipt, IndianRupee, Link as LinkIcon, Download, AlertTriangle } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { useTranslation } from '@/lib/i18n/useTranslation'
import Link from 'next/link'
import { motion } from 'framer-motion'

/* ─── Helpers ─── */
const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'abhi abhi'
  if (mins < 60) return `${mins}m pehle`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h pehle`
  return `${Math.floor(hrs / 24)}d pehle`
}

const activityIcon: Record<string, React.ReactNode> = {
  invoice_created: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  invoice_sent: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  invoice_paid: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  quotation_created: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  quotation_converted: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/></svg>,
  customer_added: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  payment_received: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  stock_low: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  shop_created: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  settings_changed: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
}

/* ─── Skeleton ─── */
function Skeleton({ className = '', style }: { className?: string, style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 dark:bg-[#2E2C28] ${className}`} style={style} />
}

/* ─── Stat Card ─── */
interface StatCardProps {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  accent: string
  loading?: boolean
}

function StatCard({ label, value, sub, icon, accent, loading }: StatCardProps) {
  return (
    <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-5 flex flex-col gap-3 ios-shadow hover:scale-[1.02] transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider">
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-[14px] flex items-center justify-center text-lg shadow-sm"
          style={{ background: accent + '15', color: accent }}
        >
          {icon}
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-32 mt-1" />
      ) : (
        <div className="text-[28px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mt-1">
          {value}
        </div>
      )}
      {loading ? (
        <Skeleton className="h-4 w-24" />
      ) : (
        <div className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D]">{sub}</div>
      )}
    </div>
  )
}

/* ─── Weekly Bar Chart ─── */
function WeeklyChart({
  data,
  loading,
  t
}: {
  data: any
  loading: boolean
  t: any
}) {
  const total = data?.reduce((acc: number, d: any) => acc + (d.revenue || d.total || 0), 0) || 0
  const max = data && data.length > 0 ? Math.max(...data.map((d: any) => d.revenue || d.total || 0)) : 1
  const avg = data && data.length > 0 ? total / data.length : 0
  const bestDay = data && data.length > 0 
    ? data.reduce((best: any, d: any) => (d.revenue || d.total || 0) > (best.revenue || best.total || 0) ? d : best, data[0]).label 
    : '-'

  return (
    <div className="h-full flex flex-col justify-between bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-6 ios-shadow">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            {t('dashboard', 'weekly_revenue')}
          </h3>
          <p className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D]">
            {t('dashboard', 'weekly_revenue_sub')}
          </p>
        </div>
        {data && (
          <div className="text-right">
            <div className="text-[20px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              {formatINR(total)}
            </div>
            <div className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D]">
              {t('dashboard', 'weekly_revenue_sub')}
            </div>
          </div>
        )}
      </div>

      {/* Quick Insights */}
      {!loading && data && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-black/5 dark:bg-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center transition-transform hover:scale-105">
            <span className="text-[11px] font-medium text-[#86868B] dark:text-[#98989D] mb-1">Daily Avg</span>
            <span className="text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">{formatINR(avg)}</span>
          </div>
          <div className="bg-black/5 dark:bg-white/5 rounded-[16px] p-3 flex flex-col items-center justify-center text-center transition-transform hover:scale-105">
            <span className="text-[11px] font-medium text-[#86868B] dark:text-[#98989D] mb-1">Best Day</span>
            <span className="text-[15px] font-bold text-[#1B7A4A] dark:text-[#25D366] tracking-tight">{bestDay !== '-' && max > 0 ? bestDay : 'None'}</span>
          </div>
          <div className="bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 rounded-[16px] p-3 flex flex-col items-center justify-center text-center transition-transform hover:scale-105 border border-[#1B7A4A]/20 dark:border-[#25D366]/20">
            <span className="text-[11px] font-medium text-[#1B7A4A] dark:text-[#25D366] mb-1">Growth</span>
            <span className="text-[15px] font-bold text-[#1B7A4A] dark:text-[#25D366] tracking-tight flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
              14.5%
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-end gap-2.5 h-[120px] mt-auto">
          {[...Array(7)].map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-[6px]"
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-end gap-2.5 h-[120px] mt-auto">
          {(data ?? []).map((d: { label: string, revenue: number, isToday: boolean }, i: number) => {
            const pct = max > 0 ? (d.revenue / max) * 100 : 0
            return (
              <div
                key={d.label}
                className="flex-1 flex flex-col items-center gap-2 group"
              >
                <div className="w-full flex items-end" style={{ height: '100px' }}>
                  <div
                    className={`w-full rounded-[6px] transition-all duration-500 relative ${
                      d.isToday
                        ? 'bg-[#1B7A4A] dark:bg-[#25D366] shadow-[0_0_15px_rgba(27,122,74,0.4)]'
                        : 'bg-black/5 dark:bg-white/10 group-hover:bg-black/10 dark:group-hover:bg-white/20'
                    }`}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap z-10 shadow-md pointer-events-none">
                      {formatINR(d.revenue)}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold ${
                    d.isToday
                      ? 'text-[#1B7A4A] dark:text-[#25D366]'
                      : 'text-[#86868B] dark:text-[#98989D]'
                  }`}
                >
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: {
      label: 'Paid',
      cls: 'bg-[#34C759]/10 text-[#34C759] dark:bg-[#30D158]/20 dark:text-[#30D158]',
    },
    partial: {
      label: 'Partial',
      cls: 'bg-[#FF9500]/10 text-[#FF9500] dark:bg-[#FF9F0A]/20 dark:text-[#FF9F0A]',
    },
    unpaid: {
      label: 'Pending',
      cls: 'bg-[#FF3B30]/10 text-[#FF3B30] dark:bg-[#FF453A]/20 dark:text-[#FF453A]',
    },
  }
  const s = map[status] ?? {
    label: status,
    cls: 'bg-black/5 text-[#86868B] dark:bg-white/10 dark:text-[#98989D]',
  }
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${s.cls}`}
    >
      {s.label}
    </span>
  )
}

/* ─── Recent Invoices ─── */
function RecentInvoices({
  data,
  loading,
  t,
}: {
  data?: Array<{
    id: string
    invoice_number: string
    customer_name: string
    total: number
    payment_status: string
    invoice_date: string
  }>
  loading: boolean
  t: any
}) {
  return (
    <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-6 ios-shadow h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            {t('dashboard', 'recent_bills')}
          </h3>
          <p className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D]">
            {t('dashboard', 'recent_bills_sub')}
          </p>
        </div>
        <Link
          href="/invoices"
          className="text-[13px] text-[#1B7A4A] dark:text-[#25D366] font-semibold hover:underline"
        >
          {t('dashboard', 'view_all')} →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-[14px] flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-10 bg-black/5 dark:bg-white/5 rounded-[16px]">
          <div className="flex justify-center mb-4 text-[#86868B] dark:text-[#98989D]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <p className="text-[14px] font-medium text-[#86868B] dark:text-[#98989D]">
            {t('dashboard', 'no_bills')}
          </p>
          <Link
            href="/invoices/new"
            className="inline-block mt-3 px-4 py-2 bg-[#1B7A4A] text-white rounded-full text-[13px] font-semibold hover:scale-105 transition-transform"
          >
            {t('dashboard', 'first_bill')}
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {data.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="flex items-center gap-3 py-3 px-3 -mx-3 rounded-[16px] hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-[14px] bg-[#1B7A4A]/10 dark:bg-[#25D366]/20 flex items-center justify-center text-[#1B7A4A] dark:text-[#25D366] text-[14px] font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
                {inv.customer_name.charAt(0).toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight truncate">
                  {inv.customer_name}
                </div>
                <div className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D]">
                  {inv.invoice_number} ·{' '}
                  {new Date(inv.invoice_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </div>
              </div>
              {/* Amount + status */}
              <div className="text-right flex-shrink-0">
                <div className="text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-1">
                  {formatINR(Number(inv.total))}
                </div>
                <StatusBadge status={inv.payment_status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Activity Feed ─── */
function ActivityFeed({
  data,
  loading,
}: {
  data?: Array<{
    id: string
    type: string
    summary: string
    created_at: string
  }>
  loading: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="h-full bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-6 ios-shadow flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            {t('dashboard', 'activity_stream')}
          </h3>
          <p className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D]">
            {t('dashboard', 'activity_stream_sub')}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="space-y-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[14px] text-[#86868B] dark:text-[#98989D]">{t('dashboard', 'no_activity')}</p>
          </div>
        ) : (
          <div className="relative h-full pr-2 overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Vertical line */}
            <div className="absolute top-4 bottom-4 left-[15px] w-0.5 bg-black/5 dark:bg-white/10" />

            <div className="space-y-6 relative">
              {data.map((act) => {
                const icon = activityIcon[act.type] || <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                return (
                  <div key={act.id} className="flex gap-4 relative group">
                    <div className="relative z-10 w-8 h-8 rounded-full bg-white dark:bg-[#1C1C1E] flex items-center justify-center text-[14px] shadow-sm shadow-black/5 dark:shadow-white/5 border border-black/5 dark:border-white/5 group-hover:scale-110 transition-transform">
                      {icon}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug group-hover:text-[#1B7A4A] dark:group-hover:text-[#25D366] transition-colors">
                        {act.summary}
                      </p>
                      <p className="text-[11px] font-medium text-[#86868B] dark:text-[#98989D] mt-1">
                        {timeAgo(act.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Button */}
      {!loading && data && data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
          <Link
            href="/activity"
            className="w-full flex items-center justify-center gap-2 py-2 text-[13px] font-semibold text-[#1B7A4A] dark:text-[#25D366] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
          >
            {t('dashboard', 'view_all')} →
          </Link>
        </div>
      )}
    </div>
  )
}

/* ─── Low Stock Alerts ─── */
function LowStockAlerts({
  data,
  loading,
}: {
  data?: Array<{
    id: string
    name: string
    stock: number
    low_stock_threshold: number | null
  }>
  loading: boolean
}) {
  const { t } = useTranslation()

  if (!loading && (!data || data.length === 0)) return null

  return (
    <div className="bg-[#FF3B30]/5 dark:bg-[#FF453A]/10 border border-[#FF3B30]/20 dark:border-[#FF453A]/20 rounded-[24px] p-6 ios-shadow mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#FF3B30] dark:text-[#FF453A]" />
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            {t('dashboard', 'low_stock_alerts')}
          </h3>
        </div>
        <Link
          href="/catalog"
          className="text-[13px] text-[#FF3B30] dark:text-[#FF453A] font-semibold hover:underline"
        >
          {t('dashboard', 'view_all')} →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-[12px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data?.map((item) => (
            <div
              key={item.id}
              className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-[#FF3B30]/10 dark:border-[#FF453A]/10 rounded-[16px] p-4 flex items-center justify-between group hover:bg-[#FF3B30]/5 dark:hover:bg-[#FF453A]/5 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate mb-0.5">
                  {item.name}
                </div>
                <div className="text-[12px] font-medium text-[#FF3B30] dark:text-[#FF453A]">
                  Only {item.stock} left (Min: {item.low_stock_threshold})
                </div>
              </div>
              <Link
                href={`/catalog`}
                className="opacity-0 group-hover:opacity-100 p-2 bg-[#FF3B30]/10 text-[#FF3B30] dark:bg-[#FF453A]/20 dark:text-[#FF453A] rounded-full transition-opacity"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Quick Actions ─── */
function QuickActions() {
  const actions: { label: string; href: string; icon: React.ReactNode; primary: boolean }[] = [
    { label: 'Naya Bill', href: '/invoices/new', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>, primary: true },
    { label: 'Customer', href: '/customers', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>, primary: false },
    { label: 'Quotation', href: '/quotations/new', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>, primary: false },
    { label: 'Catalog', href: '/catalog', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, primary: false },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`flex flex-col items-center justify-center gap-2 h-[88px] rounded-[20px] transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] ${
            a.primary
              ? 'bg-gradient-to-br from-[#1B7A4A] to-[#25D366] text-white shadow-lg shadow-[#1B7A4A]/20'
              : 'bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-white dark:hover:bg-[#2C2C2E]'
          }`}
        >
          <div className="mb-0.5">{a.icon}</div>
          <span className="text-[11px] font-semibold tracking-tight">{a.label}</span>
        </Link>
      ))}
    </div>
  )
}

/* ─── AI/ML Forecast Widget ─── */
function MLForecastWidget({
  data,
  loading,
}: {
  data?: Array<{ productName: string; predictedQuantity: number; trend: string; reason: string; recentSales: number }>
  loading: boolean
}) {
  return (
    <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-6 ios-shadow h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Sales Forecast (Next 7 Days)
          </h3>
          <p className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D]">
            Powered by Local Math Model
          </p>
        </div>
      </div>
      
      {loading ? (
        <div className="space-y-4 flex-1">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[14px]" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-[13px] text-[#86868B] dark:text-[#98989D]">Not enough sales history to forecast.</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-none">
          {data.map((item, idx) => (
            <div key={idx} className="bg-black/5 dark:bg-white/5 rounded-[16px] p-3 flex items-start gap-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${item.trend === 'up' ? 'bg-green-500/10 text-green-500' : item.trend === 'down' ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-500'}`}>
                {item.trend === 'up' ? <ArrowUpRight className="w-5 h-5" /> : item.trend === 'down' ? <ArrowDownRight className="w-5 h-5" /> : <span className="text-sm font-bold">-</span>}
              </div>
              <div className="flex-1 min-w-0 z-10">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[14px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate pr-2">{item.productName}</div>
                  <div className="text-[16px] font-black text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">{item.predictedQuantity} <span className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium">units</span></div>
                </div>
                <p className="text-[11px] text-[#86868B] dark:text-[#98989D] leading-snug">{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Top Customers Widget ─── */
function TopCustomersWidget({
  data,
  loading,
}: {
  data?: Array<{ name: string; total_billed: number }>
  loading: boolean
}) {
  const max = data && data.length > 0 ? Math.max(...data.map(d => Number(d.total_billed || 0))) : 1

  return (
    <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-6 ios-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Top Customers
          </h3>
          <p className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D]">
            By total billed amount
          </p>
        </div>
        <Users className="w-6 h-6 text-[#1B7A4A] dark:text-[#25D366] opacity-50" />
      </div>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="w-full space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))
        ) : !data || data.length === 0 ? (
          <div className="text-center text-[13px] text-[#86868B] dark:text-[#98989D]">No customers found.</div>
        ) : (
          data.map((c, i) => {
            const val = Number(c.total_billed || 0)
            const pct = (val / max) * 100
            return (
              <div key={i} className="w-full relative group">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate pr-4">{c.name}</span>
                  <span className="text-[12px] font-bold text-[#86868B] dark:text-[#98989D]">{formatINR(val)}</span>
                </div>
                <div className="h-2 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#1B7A4A] to-[#25D366] rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ─── Quick Analytics Summary ─── */
function QuickAnalyticsSummary({
  forecastData,
  topCustomersData,
  loading
}: {
  forecastData?: Array<any>
  topCustomersData?: Array<any>
  loading: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="bg-gradient-to-br from-white/90 to-white/50 dark:from-[#1C1C1E]/90 dark:to-[#1C1C1E]/50 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[24px] p-6 ios-shadow mb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            AI Analytics & VIPs
          </h3>
          <p className="text-[13px] font-medium text-[#86868B] dark:text-[#98989D]">
            A quick glimpse at your business momentum
          </p>
        </div>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#1D1D1F] dark:text-[#F5F5F7] text-[13px] font-semibold rounded-full transition-colors"
        >
          View Full Analytics
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <div>
          <h4 className="text-[12px] font-bold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider mb-3">Top VIP Customers</h4>
          {loading ? (
             <div className="space-y-2"><div className="animate-pulse h-4 w-32 bg-black/5 dark:bg-white/5"/><div className="animate-pulse h-4 w-24 bg-black/5 dark:bg-white/5"/></div>
          ) : !topCustomersData || topCustomersData.length === 0 ? (
            <p className="text-[13px] text-[#86868B] dark:text-[#98989D]">No data yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topCustomersData.slice(0, 3).map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B7A4A]/10 text-[#1B7A4A] dark:bg-[#25D366]/20 dark:text-[#25D366] text-[12px] font-bold">
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-[12px] font-bold text-[#86868B] dark:text-[#98989D] uppercase tracking-wider mb-3">Hot Products Forecast</h4>
          {loading ? (
            <div className="space-y-2"><div className="animate-pulse h-4 w-32 bg-black/5 dark:bg-white/5"/><div className="animate-pulse h-4 w-24 bg-black/5 dark:bg-white/5"/></div>
          ) : !forecastData || forecastData.length === 0 ? (
            <p className="text-[13px] text-[#86868B] dark:text-[#98989D]">Not enough history.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {forecastData.slice(0, 3).map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 text-[12px] font-bold">
                  {f.trend === 'up' ? '↗' : f.trend === 'down' ? '↘' : '-'} {f.productName} ({f.predictedQuantity})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Main Dashboard Page ─── */
export default function DashboardPage() {
  const { data: overview, isLoading: ovLoading } =
    trpc.analytics.overview.useQuery()
  const { data: lowStockItems } = trpc.products.lowStock.useQuery()
  const { t } = useTranslation()
  const { data: weeklyRev, isLoading: weekLoading } =
    trpc.analytics.weeklyRevenue.useQuery()
  const { data: recentInvoices, isLoading: invLoading } =
    trpc.analytics.recentInvoices.useQuery({ limit: 5 })
  const { data: activity, isLoading: actLoading } =
    trpc.analytics.recentActivity.useQuery({ limit: 8 })
  const { data: topCustomersData, isLoading: topCustLoading } =
    trpc.analytics.topCustomers.useQuery()
  const { data: forecastData, isLoading: forecastLoading } =
    trpc.analytics.predictProductSales.useQuery()

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="space-y-6 w-full max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight leading-none mb-1.5">
            {t('dashboard', 'welcome')}
          </h1>
          <p className="text-[14px] font-medium text-[#86868B] dark:text-[#98989D]">
            {ovLoading
              ? '...'
              : overview?.shopName
              ? `${overview.shopName} ${t('dashboard', 'shop_hisaab')}`
              : t('dashboard', 'default_subtitle')}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="hidden sm:inline-flex items-center gap-2 px-6 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-[15px] font-semibold rounded-full transition-transform shadow-lg shadow-[#1B7A4A]/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('dashboard', 'create_invoice')}
        </Link>
      </div>

      {/* Quick actions (mobile) */}
      <div className="sm:hidden">
        <QuickActions />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t('dashboard', 'today_sales')}
          value={ovLoading ? '...' : formatINR(overview?.todayRevenue ?? 0)}
          sub={t('dashboard', 'today_sales')}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12"/><path d="M6 8h12"/><path d="M6 13h8.5l-1 1H6"/><path d="M13 13c-2.5 0-4-1.5-4-3V8"/><path d="M9 13l6 8"/></svg>}
          accent="#1B7A4A"
          loading={ovLoading}
        />
        <StatCard
          label={t('dashboard', 'pending_payments')}
          value={ovLoading ? '...' : formatINR(overview?.pendingAmount ?? 0)}
          sub={t('dashboard', 'pending_payments')}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          accent="#D4920F"
          loading={ovLoading}
        />
        <StatCard
          label={t('dashboard', 'invoices_today')}
          value={ovLoading ? '...' : String(overview?.billsSentToday ?? 0)}
          sub={t('dashboard', 'invoices_today')}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
          accent="#2563EB"
          loading={ovLoading}
        />
        <StatCard
          label={t('dashboard', 'customers')}
          value={
            ovLoading ? '...' : String(overview?.newCustomersThisWeek ?? 0)
          }
          sub={t('dashboard', 'customers')}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          accent="#E8622A"
          loading={ovLoading}
        />
      </div>

      {/* Weekly chart + Activity (desktop: side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart takes 2/3 */}
        <div className="lg:col-span-2">
          <WeeklyChart
            data={weeklyRev?.map((d) => ({
              label: d.label,
              revenue: d.revenue,
              isToday: d.isToday,
            }))}
            loading={weekLoading}
            t={t}
          />
        </div>
        {/* Activity takes 1/3 on desktop */}
        <div className="hidden lg:block">
          <ActivityFeed data={activity ?? undefined} loading={actLoading} />
        </div>
      </div>

      {/* Low Stock Alerts */}
      <LowStockAlerts data={lowStockItems ?? undefined} loading={false} />

      {/* Quick Analytics Summary */}
      <QuickAnalyticsSummary 
        forecastData={forecastData ?? undefined} 
        topCustomersData={topCustomersData ?? undefined} 
        loading={forecastLoading || topCustLoading} 
      />

      {/* Recent invoices */}
      <RecentInvoices data={recentInvoices ?? undefined} loading={invLoading} t={t} />

      {/* Activity feed (mobile — shown below invoices) */}
      <div className="lg:hidden pb-4">
        <ActivityFeed data={activity ?? undefined} loading={actLoading} />
      </div>
    </motion.div>
  )
}
