'use client'

import { useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { PaymentStatusBadge } from '@/components/invoices/PaymentStatusBadge'

/* ─── Helpers ─── */
const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const formatDate = (d: string) => {
  if (!d) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
  } catch {
    return d
  }
}

const avatarColor = (name: string) => {
  const colors = [
    ['#0D2E1F', '#25D366'], ['#1a1a2e', '#4361ee'], ['#2d1b00', '#f48c06'],
    ['#1a0a0a', '#e63946'], ['#0a1a2d', '#4cc9f0'], ['#1a0d2e', '#7b2d8b'],
  ]
  return colors[(name || 'A').charCodeAt(0) % colors.length]
}

/* ─── Component ─── */
export default function CustomerAnalyticsDrawer({
  customerId,
  open,
  onClose,
}: {
  customerId: string | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { data, isLoading, error } = trpc.customers.getAnalytics.useQuery(
    { id: customerId || '' },
    { enabled: !!customerId && open }
  )

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = 'auto' }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-[#F5F5F7] dark:bg-[#000000] shadow-2xl z-[70] flex flex-col transform transition-transform duration-300 ease-in-out border-l border-white/20 dark:border-white/5">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-black/5 dark:border-white/5 bg-white dark:bg-[#1C1C1E] flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Customer Profile</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-4">
              <div className="w-8 h-8 border-4 border-[#1B7A4A] dark:border-[#25D366] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500">Loading profile...</p>
            </div>
          ) : error || !data ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl">Error loading customer data.</div>
          ) : (
            <>
              {/* Profile Card */}
              <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 shadow-sm border border-black/5 dark:border-white/5 flex flex-col items-center text-center">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-inner"
                  style={{ background: avatarColor(data.customer.name)[0], color: avatarColor(data.customer.name)[1] }}
                >
                  {data.customer.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">{data.customer.name}</h3>
                {data.customer.phone && (
                  <p className="text-gray-500 dark:text-[#98989D] mt-1 font-medium">📞 {data.customer.phone}</p>
                )}
                {data.customer.address && (
                  <p className="text-gray-500 dark:text-[#98989D] mt-2 text-sm max-w-xs">{data.customer.address}</p>
                )}
                {data.customer.tags && data.customer.tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {data.customer.tags.map((tag: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 rounded-full text-xs font-semibold">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col justify-center">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Billed</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{formatINR(data.stats.total_billed)}</p>
                </div>
                <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col justify-center relative overflow-hidden">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Balance Due</p>
                  <p className={`text-2xl font-black ${data.stats.balance_due > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatINR(data.stats.balance_due)}
                  </p>
                  {data.stats.balance_due > 0 && <div className="absolute top-0 right-0 w-8 h-8 bg-red-500/10 rounded-bl-full" />}
                </div>
              </div>

              {/* Recent Invoices Ledger */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Recent Invoices</h3>
                  <span className="text-xs font-bold text-gray-400">{data.stats.bill_count} Total</span>
                </div>
                
                {data.recent_invoices.length === 0 ? (
                  <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 text-center border border-black/5 dark:border-white/5 shadow-sm">
                    <span className="text-3xl">🧾</span>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm font-medium">No invoices found for this customer.</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
                    <ul className="divide-y divide-gray-100 dark:divide-[#2C2C2E]">
                      {data.recent_invoices.map((inv: any) => (
                        <li key={inv.id} className="hover:bg-gray-50 dark:hover:bg-[#252527] transition-colors">
                          <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between p-4 block">
                            <div>
                              <p className="text-xs font-bold text-gray-500 mb-1">{inv.invoice_number} • {formatDate(inv.invoice_date)}</p>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{formatINR(inv.total)}</p>
                            </div>
                            <div className="text-right">
                              <PaymentStatusBadge status={inv.payment_status} />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
