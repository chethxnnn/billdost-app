'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { QuotationStatusBadge } from '@/components/quotations/QuotationStatusBadge'

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

/* ─── Quotation Card ─── */
function QuotationCard({ quotation }: { quotation: any }) {

  return (
    <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-2xl p-4 hover:shadow-md dark:hover:border-[#48484A] transition-all duration-200">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-xs font-bold text-gray-500 dark:text-[#98989D] uppercase tracking-widest mb-1">
            {quotation.quotation_number}
          </div>
          <div className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">
            {quotation.customer_name}
          </div>
          <div className="text-xs text-gray-400 dark:text-[#98989D] mt-0.5">
            {formatDate(quotation.created_at)}
          </div>
        </div>
        
        <div className="text-right">
          <div className="font-black text-lg text-gray-900 dark:text-white">
            {formatINR(quotation.total)}
          </div>
          <div className="mt-1 flex justify-end">
            <QuotationStatusBadge status={quotation.status} />
          </div>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-gray-50 dark:border-[#38383A] flex justify-between items-center">
        <div className="text-xs text-gray-500 dark:text-[#98989D]">
          Valid til: <span className="font-bold text-gray-900 dark:text-white">{quotation.valid_until ? formatDate(quotation.valid_until) : 'N/A'}</span>
        </div>
        
        <Link href={`/quotations/${quotation.id}`} className="text-[#1B7A4A] dark:text-[#25D366] text-xs font-bold hover:underline">
          View Details →
        </Link>
      </div>
    </div>
  )
}

/* ─── Skeleton ─── */
function Skeleton() {
  return (
    <div className="animate-pulse bg-gray-100 dark:bg-[#38383A] rounded-2xl h-32 w-full" />
  )
}

/* ─── Main Page ─── */
export default function QuotationsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const { data: quotations, isLoading } = trpc.quotations.list.useQuery({
    search: search || undefined,
    status: status,
  })

  return (
    <div className="space-y-6 w-full max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Quotations 📄
          </h1>
          <p className="text-sm text-gray-400 dark:text-[#98989D] mt-0.5">
            {isLoading ? '...' : `${quotations?.length ?? 0} quotations found`}
          </p>
        </div>
        <Link
          href="/quotations/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#1B7A4A]/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="text-base">+</span>
          Naya Quotation
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#98989D] w-4 h-4 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer ya quotation number se dhoondo..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] transition-colors"
          />
        </div>
        
        <div className="flex bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl p-1 overflow-x-auto hide-scrollbar">
          {['all', 'draft', 'sent', 'accepted', 'rejected', 'converted'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatus(tab)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold capitalize whitespace-nowrap transition-colors ${
                status === tab 
                  ? 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-[#98989D] dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : !quotations || quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {search || status !== 'all' ? 'Koi quotation nahi mila' : 'Abhi tak koi quotation nahi banaya'}
          </h3>
          <p className="text-sm text-gray-400 dark:text-[#98989D] mb-6 max-w-xs">
            {search || status !== 'all' ? 'Filter change karke try karo' : 'Pehla quotation banao aur apna business manage karna shuru karo!'}
          </p>
          {(!search && status === 'all') && (
            <Link
              href="/quotations/new"
              className="px-6 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#1B7A4A]/20"
            >
              + Pehla Quotation Banao
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {quotations.map((qt) => (
            <QuotationCard key={qt.id} quotation={qt} />
          ))}
        </div>
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
