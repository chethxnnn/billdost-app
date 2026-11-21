'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { BellRing, HandCoins, PauseCircle, PlayCircle, Search } from 'lucide-react'
import { ErrorFallback } from '@/components/shared/ErrorFallback'
import { normalizePhone } from '@/lib/phone'
import { useShop } from '@/components/shared/ShopContext'
import {
  AGEING_BUCKETS,
  ageingBucketFor,
  daysBetween,
  summariseAgeing,
} from '@/lib/udhaar'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

interface DueEntry {
  customer_id: string
  customer_name: string
  customer_phone: string | null
  outstanding: number
  opening_balance: number
  bill_count: number
  oldest_unpaid_date: string | null
  reminders_paused: boolean
}

/**
 * Udhaar book (blueprint D7): every customer's outstanding from the
 * payments ledger, bucketed by how old the oldest unpaid bill is.
 * Payments are recorded against the oldest bills first through the
 * record_udhaar_payment_tx RPC; reminders go through the official
 * WhatsApp Cloud API with an honest wa.me fallback.
 */
export default function UdhaarPage() {
  const utils = trpc.useUtils()
  const { shopName: contextShopName } = useShop()
  const dueQuery = trpc.reminders.listDue.useQuery()
  const logQuery = trpc.reminders.listLog.useQuery()
  const recordMut = trpc.reminders.recordUdhaarPayment.useMutation()
  const pauseMut = trpc.reminders.setPaused.useMutation()
  const reminderMut = trpc.whatsapp.sendReminder.useMutation()

  const [search, setSearch] = useState('')
  const [payFor, setPayFor] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState<'cash' | 'upi' | 'bank'>('cash')

  const entries = (dueQuery.data?.entries || []) as DueEntry[]
  const summary = useMemo(() => summariseAgeing(entries), [entries])
  const filtered = entries.filter((e) =>
    e.customer_name.toLowerCase().includes(search.trim().toLowerCase())
  )

  const refresh = () => {
    void utils.reminders.listDue.invalidate()
    void utils.reminders.listLog.invalidate()
  }

  const handleRecordPayment = async (entry: DueEntry) => {
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) {
      toast.error('Sahi amount daalo.')
      return
    }
    try {
      const res = await recordMut.mutateAsync({
        customer_id: entry.customer_id,
        amount,
        mode: payMode,
      })
      if (res.unallocated > 0) {
        toast.success(
          `${formatINR(res.allocated)} purane bills me adjust ho gaya. ${formatINR(res.unallocated)} zyada aaya, wo kisi bill se juda nahi hai.`
        )
      } else {
        toast.success(`${formatINR(res.allocated)} ka payment record ho gaya.`)
      }
      setPayFor(null)
      setPayAmount('')
      refresh()
    } catch (err: any) {
      toast.error(err.message || 'Payment record nahi ho paya.')
    }
  }

  const handleReminder = async (entry: DueEntry) => {
    if (entry.reminders_paused) {
      toast.error('Is customer ke reminders band hain. Pehle chalu karo.')
      return
    }
    if (!entry.customer_phone) {
      toast.error(`${entry.customer_name} ka phone number nahi hai. Pehle customer me number jodo.`)
      return
    }
    // 1. Official WhatsApp Cloud API (server logs the attempt in
    // reminder_log either way). No fake success: a refusal from the
    // server is shown as-is.
    try {
      await reminderMut.mutateAsync({ customerId: entry.customer_id })
      toast.success(`${entry.customer_name} ko reminder bhej diya.`)
      refresh()
      return
    } catch (err: any) {
      const message = err?.message || 'WhatsApp API se reminder nahi bheja gaya.'
      // Paused or nothing-due refusals are final answers, not
      // connection problems, so no wa.me fallback for them.
      if (message.includes('band hain') || message.includes('baaki nahi')) {
        toast.error(message)
        refresh()
        return
      }
      toast.warning(message, { duration: 5000 })
    }
    // 2. Honest fallback: the owner sends it himself via wa.me.
    const normalized = normalizePhone(entry.customer_phone)
    if (!normalized) {
      toast.error('Customer ka phone number sahi nahi hai!')
      return
    }
    const shopName = contextShopName || 'Apni Dukaan'
    const msg = encodeURIComponent(
      `Namaste ${entry.customer_name} ji, ${shopName} se aapka ${formatINR(entry.outstanding)} baki hai. Kripya payment kar dein. Dhanyavaad!`
    )
    window.open(`https://wa.me/${normalized}?text=${msg}`, '_blank')
    refresh()
  }

  const handlePauseToggle = async (entry: DueEntry) => {
    try {
      await pauseMut.mutateAsync({
        customer_id: entry.customer_id,
        paused: !entry.reminders_paused,
      })
      toast.success(
        entry.reminders_paused
          ? 'Reminders phir se chalu ho gaye.'
          : 'Is customer ke reminders band kar diye.'
      )
      refresh()
    } catch {
      toast.error('Setting save nahi ho payi.')
    }
  }

  if (dueQuery.isLoading) {
    return (
      <div className="w-full max-w-[1100px] mx-auto space-y-3" aria-busy="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 dark:bg-[#2C2C2E] rounded-3xl h-24 w-full" />
        ))}
      </div>
    )
  }
  if (dueQuery.error) {
    return (
      <ErrorFallback
        error={new Error(dueQuery.error.message)}
        onRetry={() => void dueQuery.refetch()}
        variant="inline"
      />
    )
  }

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Udhaar</h1>
        <p className="text-gray-500 dark:text-[#98989D] mt-1 text-[15px]">
          Kiska kitna baki hai, sabse purana bill kitna purana hai, aur reminder ek tap me.
        </p>
      </div>

      {/* Ageing summary from the ledger, never typed numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-[#1D1D1F] dark:bg-white text-white dark:text-black rounded-3xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Kul Baki</p>
          <p className="text-2xl font-extrabold mt-1">{formatINR(summary.total)}</p>
          <p className="text-xs opacity-70 mt-1">{entries.length} customers</p>
        </div>
        {AGEING_BUCKETS.map((b) => (
          <div
            key={b.key}
            className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{b.label}</p>
            <p className="text-2xl font-extrabold mt-1 text-gray-900 dark:text-white">
              {formatINR(summary.buckets[b.key].amount)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{summary.buckets[b.key].count} customers</p>
          </div>
        ))}
      </div>

      {(dueQuery.data?.unattributed_total || 0) > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-2xl px-4 py-3">
          {formatINR(dueQuery.data?.unattributed_total || 0)} walk-in bills par baki hai jinka customer
          record nahi hai. Inhe bill ki detail se hi collect karna hoga.
        </p>
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Customer dhundho..."
          aria-label="Customer dhundho"
          className="w-full min-h-[48px] pl-10 pr-4 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl text-sm outline-none focus:border-[#1B7A4A]"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-8 text-center">
            <p className="font-bold text-gray-900 dark:text-white">Kisi ka udhaar baki nahi hai</p>
            <p className="text-sm text-gray-500 mt-1">Jab koi bill bina full payment ke bane ga, wo yahan dikhega.</p>
          </div>
        ) : (
          filtered.map((entry) => {
            const days = entry.oldest_unpaid_date
              ? daysBetween(new Date(entry.oldest_unpaid_date), new Date())
              : 0
            const bucket = ageingBucketFor(days)
            const bucketLabel = AGEING_BUCKETS.find((b) => b.key === bucket)?.label
            const isPaying = payFor === entry.customer_id
            return (
              <div
                key={entry.customer_id}
                className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-gray-900 dark:text-white truncate">
                      {entry.customer_name}
                      {entry.reminders_paused && (
                        <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                          Reminder band
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.bill_count > 0
                        ? `${entry.bill_count} bills · sabse purana ${entry.oldest_unpaid_date ? formatDate(entry.oldest_unpaid_date) : ''} (${days} din)`
                        : 'Sirf opening balance'}
                      {entry.opening_balance > 0 && entry.bill_count > 0
                        ? ` · opening ${formatINR(entry.opening_balance)} shamil`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-red-600 dark:text-red-400">
                      {formatINR(entry.outstanding)}
                    </p>
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300">
                      {bucketLabel}
                    </span>
                  </div>
                </div>

                {isPaying ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="Kitna mila?"
                      aria-label="Payment amount"
                      className="w-36 min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
                    />
                    <div className="flex gap-1" role="radiogroup" aria-label="Payment mode">
                      {(['cash', 'upi', 'bank'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={payMode === m}
                          onClick={() => setPayMode(m)}
                          className={`tap min-h-[48px] px-4 rounded-full text-sm font-bold capitalize ${
                            payMode === m
                              ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-black'
                              : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRecordPayment(entry)}
                      disabled={recordMut.isPending}
                      className="tap min-h-[48px] px-5 rounded-full bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-50 text-white font-bold text-sm transition-colors"
                    >
                      Save Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayFor(null)}
                      className="tap min-h-[48px] px-4 rounded-full border border-gray-200 dark:border-[#38383A] font-bold text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPayFor(entry.customer_id)
                        setPayAmount(String(entry.outstanding))
                      }}
                      className="tap inline-flex items-center gap-2 min-h-[48px] px-4 rounded-full bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold text-sm transition-colors"
                    >
                      <HandCoins className="w-4 h-4" aria-hidden="true" />
                      Payment Liya
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReminder(entry)}
                      disabled={entry.reminders_paused || reminderMut.isPending}
                      className="tap inline-flex items-center gap-2 min-h-[48px] px-4 rounded-full bg-[#25D366]/15 text-[#1B7A4A] dark:text-[#25D366] font-bold text-sm disabled:opacity-40"
                    >
                      <BellRing className="w-4 h-4" aria-hidden="true" />
                      Reminder Bhejo
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePauseToggle(entry)}
                      disabled={pauseMut.isPending}
                      className="tap inline-flex items-center gap-2 min-h-[48px] px-4 rounded-full border border-gray-200 dark:border-[#38383A] font-bold text-sm disabled:opacity-40"
                    >
                      {entry.reminders_paused ? (
                        <>
                          <PlayCircle className="w-4 h-4" aria-hidden="true" /> Reminder Chalu Karo
                        </>
                      ) : (
                        <>
                          <PauseCircle className="w-4 h-4" aria-hidden="true" /> Reminder Band Karo
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Reminder log: what was actually sent, from reminder_log */}
      {(logQuery.data || []).length > 0 && (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-5">
          <h2 className="font-extrabold text-gray-900 dark:text-white">Bheje Gaye Reminders</h2>
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-[#38383A]">
            {(logQuery.data || []).map((row) => (
              <li key={row.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold truncate block">{row.customer_name || 'Customer'}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(row.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    · {row.channel === 'api' ? 'WhatsApp API' : 'wa.me link'}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="font-bold">{formatINR(row.amount_due)}</span>
                  <span
                    className={`block text-[11px] font-bold uppercase tracking-wide ${
                      row.status === 'sent' ? 'text-[#1B7A4A]' : 'text-gray-400'
                    }`}
                  >
                    {row.status === 'sent' ? 'Bhej diya' : row.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
