'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { Search } from 'lucide-react'
import { ErrorFallback } from '@/components/shared/ErrorFallback'
import { useShop } from '@/components/shared/ShopContext'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

type ModeFilter = 'all' | 'cash' | 'upi' | 'bank'

const MODE_LABELS: Record<string, string> = { cash: 'Cash', upi: 'UPI', bank: 'Bank' }

/**
 * Payments history (blueprint D19): every rupee that came in, from
 * the payments ledger, with date, mode and text filters. Totals are
 * the server summary of the same filtered rows. Cashiers see only
 * their own collections (enforced server-side).
 */
export default function PaymentsPage() {
  const { role } = useShop()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState<ModeFilter>('all')
  const [search, setSearch] = useState('')

  const filters = {
    from: from || undefined,
    to: to || undefined,
    mode: mode === 'all' ? undefined : mode,
    search: search.trim() || undefined,
  }
  const listQuery = trpc.payments.list.useQuery(filters)
  const summaryQuery = trpc.payments.summary.useQuery(filters)

  if (listQuery.error) {
    return (
      <ErrorFallback
        error={new Error(listQuery.error.message)}
        onRetry={() => void listQuery.refetch()}
        variant="inline"
      />
    )
  }

  const rows = listQuery.data || []
  const summary = summaryQuery.data

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Payments</h1>
        <p className="text-gray-500 dark:text-[#98989D] mt-1 text-[15px]">
          Jo paisa aaya, kab aaya, kis bill ke liye aaya, sab yahan hai.
          {role === 'cashier' && ' Aap sirf apne liye hue payments dekh rahe ho.'}
        </p>
      </div>

      {/* Summary of the same filtered rows */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#1D1D1F] dark:bg-white text-white dark:text-black rounded-3xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Kul Aaya</p>
          <p className="text-2xl font-extrabold mt-1">{formatINR(summary?.total || 0)}</p>
          <p className="text-xs opacity-70 mt-1">{summary?.count || 0} payments</p>
        </div>
        {(['cash', 'upi', 'bank'] as const).map((m) => (
          <div
            key={m}
            className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{MODE_LABELS[m]}</p>
            <p className="text-2xl font-extrabold mt-1 text-gray-900 dark:text-white">
              {formatINR(summary?.byMode?.[m]?.amount || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{summary?.byMode?.[m]?.count || 0} payments</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bill number ya customer dhundho..."
            aria-label="Payment dhundho"
            className="w-full min-h-[48px] pl-10 pr-4 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl text-sm outline-none focus:border-[#1B7A4A]"
          />
        </div>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Shuru ki date"
          className="min-h-[48px] px-3 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl text-sm outline-none focus:border-[#1B7A4A]"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Aakhri date"
          className="min-h-[48px] px-3 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl text-sm outline-none focus:border-[#1B7A4A]"
        />
        <div className="flex gap-1" role="radiogroup" aria-label="Mode filter">
          {(['all', 'cash', 'upi', 'bank'] as ModeFilter[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`tap min-h-[48px] px-4 rounded-full text-sm font-bold ${
                mode === m
                  ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-black'
                  : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300'
              }`}
            >
              {m === 'all' ? 'Sab' : MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger rows */}
      {listQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 dark:bg-[#2C2C2E] rounded-2xl h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-8 text-center">
          <p className="font-bold text-gray-900 dark:text-white">Is filter me koi payment nahi mila</p>
          <p className="text-sm text-gray-500 mt-1">Date ya mode badal kar dekho, ya pehla bill banao.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl overflow-hidden">
          <ul className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                    {row.invoice_number ? (
                      <Link href={`/invoices/${row.invoice_id}`} className="hover:text-[#1B7A4A] hover:underline">
                        Bill {row.invoice_number}
                      </Link>
                    ) : (
                      'Bill'
                    )}
                    {row.customer_name && (
                      <span className="font-semibold text-gray-500"> · {row.customer_name}</span>
                    )}
                    {row.mine && (
                      <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-[#1B7A4A]">Maine liya</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {new Date(row.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300 shrink-0">
                  {MODE_LABELS[row.mode] || row.mode}
                </span>
                <span className="font-extrabold text-gray-900 dark:text-white shrink-0">
                  {formatINR(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
