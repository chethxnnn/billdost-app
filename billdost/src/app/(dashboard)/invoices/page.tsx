'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useShop } from '@/components/shared/ShopContext'
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

/* ─── Invoice Card ─── */
function InvoiceCard({ invoice, isSelected, onToggle, t }: { invoice: any, isSelected: boolean, onToggle: (id: string) => void, t: any }) {
  const isPaid = invoice.payment_status === 'paid'
  const isPartial = invoice.payment_status === 'partial'
  
  return (
    <div 
      className={`relative bg-white dark:bg-[#1C1C1E] border rounded-2xl p-4 transition-all duration-200 ${
        isPaid ? 'border-gray-100 dark:border-[#38383A] opacity-75' :
        isSelected 
          ? 'border-[#1B7A4A] dark:border-[#25D366] shadow-sm bg-[#1B7A4A]/5 dark:bg-[#25D366]/5 cursor-pointer' 
          : 'border-gray-100 dark:border-[#38383A] hover:shadow-md dark:hover:border-[#48484A] cursor-pointer'
      }`}
      onClick={(e) => {
        if (isPaid) return
        if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) return
        onToggle(invoice.id)
      }}
    >
      {!isPaid && (
        <div className="absolute top-4 right-4 z-10">
          <input 
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(invoice.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded border-gray-300 text-[#1B7A4A] focus:ring-[#1B7A4A] cursor-pointer"
          />
        </div>
      )}

      <div className={`flex justify-between items-start mb-3 ${!isPaid ? 'pr-8' : ''}`}>
        <div>
          <div className="text-xs font-bold text-gray-500 dark:text-[#98989D] uppercase tracking-widest mb-1">
            {invoice.invoice_number}
          </div>
          <div className="font-bold text-gray-900 dark:text-white truncate max-w-[180px]">
            {invoice.customer_name}
          </div>
          <div className="text-xs text-gray-400 dark:text-[#98989D] mt-0.5">
            {formatDate(invoice.invoice_date)}
          </div>
        </div>
        
        <div className="text-right">
          <div className="font-black text-lg text-gray-900 dark:text-white">
            {formatINR(invoice.total)}
          </div>
          <div className="mt-1 flex justify-end">
            <PaymentStatusBadge status={invoice.payment_status} balanceDue={invoice.balance_due} />
          </div>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-gray-50 dark:border-[#38383A] flex justify-between items-center">
        <div className="text-xs text-gray-500 dark:text-[#98989D]">
          {t('invoices', 'balance')}: <span className="font-bold text-gray-900 dark:text-white">{formatINR(invoice.balance_due)}</span>
        </div>
        
        <Link href={`/invoices/${invoice.id}`} className="text-[#1B7A4A] dark:text-[#25D366] text-xs font-bold hover:underline">
          {t('invoices', 'view_details')} →
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
export default function InvoicesPage() {
  const utils = trpc.useUtils()
  const { t } = useTranslation()
  // Bulk mark paid is manager and owner only (blueprint C4); the
  // router enforces it, the UI mirrors it for cashiers.
  const { role } = useShop()
  const canBulkPay = role !== 'cashier'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: invoices, isLoading } = trpc.invoices.list.useQuery({
    search: search || undefined,
    status: status,
  })

  const bulkMarkPaidMut = trpc.invoices.bulkMarkPaid.useMutation()

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleSelectAll = () => {
    if (!invoices) return
    if (selectedIds.size === invoices.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(invoices.map(i => i.id)))
  }

  const handleBulkMarkPaid = () => {
    if (selectedIds.size === 0) return
    
    toast('Confirm Action', {
      description: `Are you sure you want to mark ${selectedIds.size} invoices as PAID?`,
      action: {
        label: 'Yes, Mark PAID',
        onClick: async () => {
          try {
            await bulkMarkPaidMut.mutateAsync({ ids: Array.from(selectedIds) })
            toast.success(`Successfully marked ${selectedIds.size} invoices as paid.`)
            setSelectedIds(new Set())
            utils.invoices.list.invalidate()
          } catch (err: any) {
            toast.error(err.message)
          }
        }
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {}
      }
    })
  }

  return (
    <div className="space-y-6 w-full max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {t('invoices', 'title')} 🧾
          </h1>
          <p className="text-sm text-gray-400 dark:text-[#98989D] mt-0.5">
            {isLoading ? '...' : `${invoices?.length ?? 0} ${t('invoices', 'bills_found')}`}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#1B7A4A]/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="text-base">+</span>
          {t('invoices', 'new_invoice')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#98989D] w-4 h-4 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('invoices', 'search')}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] transition-colors"
            />
          </div>
          
          <div className="flex bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl p-1 overflow-x-auto hide-scrollbar">
            {['all', 'unpaid', 'partial', 'paid'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatus(tab)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold capitalize whitespace-nowrap transition-colors ${
                  status === tab 
                    ? 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-[#98989D] dark:hover:text-white'
                }`}
              >
                {tab === 'all' ? 'All' : t('invoices', tab)}
              </button>
            ))}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex p-1 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-sm shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'grid' 
                ? 'bg-[#1B7A4A] text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-900 dark:text-[#98989D] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
            }`}
          >
            <GridIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'list' 
                ? 'bg-[#1B7A4A] text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-900 dark:text-[#98989D] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
            }`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {search || status !== 'all' ? t('invoices', 'no_bills_found') : t('invoices', 'no_bills_yet')}
          </h3>
          <p className="text-sm text-gray-400 dark:text-[#98989D] mb-6 max-w-xs">
            {search || status !== 'all' ? t('invoices', 'try_filter') : t('invoices', 'create_first_business')}
          </p>
          {(!search && status === 'all') && (
            <Link
              href="/invoices/new"
              className="px-6 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#1B7A4A]/20"
            >
              + {t('invoices', 'new_invoice')}
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {invoices.map((inv) => (
            <InvoiceCard 
              key={inv.id} 
              invoice={inv} 
              isSelected={selectedIds.has(inv.id)}
              onToggle={handleToggle}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-2xl overflow-hidden shadow-sm overflow-x-auto hide-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-[#1C1C1E] border-b border-gray-100 dark:border-[#38383A]">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox"
                    checked={selectedIds.size === invoices.length && invoices.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-[#1B7A4A] focus:ring-[#1B7A4A] cursor-pointer"
                  />
                </th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Invoice</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Customer</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Total</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Status</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Balance</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
              {invoices.map((inv) => {
                const isPaid = inv.payment_status === 'paid'
                const isPartial = inv.payment_status === 'partial'
                return (
                  <tr 
                    key={inv.id} 
                    className={`hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E] transition-colors ${selectedIds.has(inv.id) ? 'bg-[#1B7A4A]/5' : ''}`}
                    onClick={() => {
                      if (!isPaid) handleToggle(inv.id)
                    }}
                  >
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      {!isPaid && (
                        <input 
                          type="checkbox"
                          checked={selectedIds.has(inv.id)}
                          onChange={() => handleToggle(inv.id)}
                          className="w-4 h-4 rounded border-gray-300 text-[#1B7A4A] focus:ring-[#1B7A4A] cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-widest">{inv.invoice_number}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-sm text-gray-900 dark:text-white">{inv.customer_name}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-600 dark:text-[#98989D]">{formatDate(inv.invoice_date)}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-extrabold text-sm text-gray-900 dark:text-white">{formatINR(inv.total)}</div>
                    </td>
                    <td className="p-4 text-center">
                      <PaymentStatusBadge status={inv.payment_status} balanceDue={inv.balance_due} />
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-bold text-sm text-gray-900 dark:text-white">{formatINR(inv.balance_due)}</div>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/invoices/${inv.id}`} className="text-[#1B7A4A] dark:text-[#25D366] text-xs font-bold hover:underline">
                        {t('invoices', 'view_details')} →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-gray-900 dark:bg-white rounded-2xl shadow-2xl p-4 flex items-center justify-between z-50 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#1B7A4A] flex items-center justify-center text-white font-bold text-sm">
              {selectedIds.size}
            </span>
            <span className="text-white dark:text-gray-900 font-semibold text-sm">{t('invoices', 'bills_selected')}</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-900 transition-colors"
            >
              {t('common', 'cancel')}
            </button>
            {canBulkPay && (
            <button
              onClick={handleBulkMarkPaid}
              disabled={bulkMarkPaidMut.isPending}
              className="bg-[#1B7A4A] hover:bg-[#155F3A] text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-colors disabled:opacity-50"
            >
              {bulkMarkPaidMut.isPending ? t('invoices', 'saving') : t('invoices', 'mark_paid')}
            </button>
            )}
          </div>
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

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}
