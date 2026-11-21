'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const formatDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'No expiry'

interface BatchRow {
  id: string
  product_id: string
  product_name: string | null
  batch_no: string
  expiry_date: string | null
  qty: number
  cost_price: number | null
  mrp: number | null
}

interface ExpiringRow extends BatchRow {
  days_left: number
}

/**
 * Batch and expiry management (blueprint D5): add batches (stock,
 * log and batch qty move together inside add_product_batch_tx), see
 * what is expired or expiring in 7 or 30 days, and write off expired
 * batches. Billing still deducts from overall product stock; FEFO
 * batch allocation at billing is the documented Stage 5 change in
 * docs/fefo-batch-allocation.md.
 */
export function BatchExpiryTab() {
  const utils = trpc.useUtils()
  const productsQuery = trpc.products.list.useQuery({ active: true })
  const batchesQuery = trpc.products.listBatches.useQuery({})
  const expiringQuery = trpc.products.expiringSoon.useQuery()
  const addMut = trpc.products.addBatch.useMutation()
  const writeOffMut = trpc.products.writeOffBatch.useMutation()

  const [form, setForm] = useState({
    product_id: '',
    batch_no: '',
    expiry_date: '',
    qty: '',
    mrp: '',
    cost_price: '',
  })

  const batches = (batchesQuery.data || []) as BatchRow[]
  const expiring = expiringQuery.data

  const refresh = () => {
    void utils.products.listBatches.invalidate()
    void utils.products.expiringSoon.invalidate()
    void utils.products.list.invalidate()
  }

  const handleAdd = async () => {
    const qty = parseFloat(form.qty)
    if (!form.product_id) {
      toast.error('Pehle product chuno.')
      return
    }
    if (!form.batch_no.trim()) {
      toast.error('Batch number likho.')
      return
    }
    if (!qty || qty <= 0) {
      toast.error('Sahi quantity daalo.')
      return
    }
    try {
      await addMut.mutateAsync({
        product_id: form.product_id,
        batch_no: form.batch_no.trim(),
        expiry_date: form.expiry_date || null,
        qty,
        mrp: form.mrp ? parseFloat(form.mrp) : null,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      })
      toast.success('Batch jud gaya, stock badh gaya hai.')
      setForm({ product_id: '', batch_no: '', expiry_date: '', qty: '', mrp: '', cost_price: '' })
      refresh()
    } catch (err: any) {
      toast.error(err.message || 'Batch add nahi ho paya.')
    }
  }

  const handleWriteOff = async (batch: { id: string; batch_no: string }) => {
    try {
      await writeOffMut.mutateAsync({ batch_id: batch.id })
      toast.success(`Batch ${batch.batch_no} write-off ho gaya.`)
      refresh()
    } catch (err: any) {
      toast.error(err.message || 'Write-off nahi ho paya.')
    }
  }

  const renderExpiringSection = (
    title: string,
    rows: ExpiringRow[],
    tone: string,
    showWriteOff: boolean
  ) => (
    <div>
      <h3 className={`text-sm font-extrabold uppercase tracking-wider ${tone}`}>{title} ({rows.length})</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 mt-1.5">Kuch nahi hai is list me.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#2C2C2E] text-sm"
            >
              <span className="flex-1 min-w-0">
                <span className="font-bold truncate block">{r.product_name || 'Product'}</span>
                <span className="text-xs text-gray-500">
                  Batch {r.batch_no} · Expiry {formatDate(r.expiry_date)} ·{' '}
                  {r.days_left < 0 ? `${Math.abs(r.days_left)} din pehle khatm` : `${r.days_left} din bache`}
                </span>
              </span>
              <span className="font-bold shrink-0">Qty {r.qty}</span>
              {showWriteOff && (
                <button
                  type="button"
                  onClick={() => void handleWriteOff(r)}
                  disabled={writeOffMut.isPending}
                  className="tap inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Write Off
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
      {/* Add batch */}
      <div className="border border-gray-100 dark:border-[#38383A] rounded-2xl p-4 space-y-3">
        <h3 className="font-extrabold text-gray-900 dark:text-white">Naya Batch Jodo</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <select
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            aria-label="Product chuno"
            className="col-span-2 lg:col-span-1 min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          >
            <option value="">Product chuno...</option>
            {(productsQuery.data || []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={form.batch_no}
            onChange={(e) => setForm({ ...form, batch_no: e.target.value })}
            placeholder="Batch No (jaise B-102)"
            aria-label="Batch number"
            className="min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
          <input
            type="date"
            value={form.expiry_date}
            onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
            aria-label="Expiry date"
            className="min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
          <input
            type="number"
            min="0"
            step="0.001"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
            placeholder="Quantity"
            aria-label="Quantity"
            className="min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.mrp}
            onChange={(e) => setForm({ ...form, mrp: e.target.value })}
            placeholder="MRP (Rs)"
            aria-label="MRP"
            className="min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.cost_price}
            onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
            placeholder="Kharid Daam (Rs)"
            aria-label="Cost price"
            className="min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={addMut.isPending}
          className="tap min-h-[48px] px-6 rounded-full bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-50 text-white font-bold text-sm transition-colors"
        >
          Batch Jodo
        </button>
        <p className="text-xs text-gray-500">
          Note: abhi billing par stock kul quantity se kat ta hai. Batch ke hisaab se pehle purana
          batch (FEFO) katna Stage 5 me aayega, uski poori detail docs me likhi hai.
        </p>
      </div>

      {/* Expiry alerts */}
      {expiringQuery.isLoading ? (
        <div className="animate-pulse bg-gray-100 dark:bg-[#2C2C2E] rounded-2xl h-24 w-full" aria-busy="true" />
      ) : expiring ? (
        <div className="space-y-5">
          {renderExpiringSection('Expiry Khatm Ho Gayi', expiring.expired as ExpiringRow[], 'text-red-600 dark:text-red-400', true)}
          {renderExpiringSection('7 Din Me Khatm Hogi', expiring.within7 as ExpiringRow[], 'text-amber-600 dark:text-amber-400', false)}
          {renderExpiringSection('30 Din Me Khatm Hogi', expiring.within30 as ExpiringRow[], 'text-gray-500', false)}
        </div>
      ) : null}

      {/* All batches */}
      <div>
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-500">Saare Batches ({batches.length})</h3>
        {batchesQuery.isLoading ? (
          <div className="animate-pulse bg-gray-100 dark:bg-[#2C2C2E] rounded-2xl h-24 w-full mt-2" aria-busy="true" />
        ) : batches.length === 0 ? (
          <p className="text-sm text-gray-500 mt-1.5">Abhi koi batch nahi hai. Upar se pehla batch jodo.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {batches.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#2C2C2E] text-sm"
              >
                <span className="flex-1 min-w-0">
                  <span className="font-bold truncate block">{b.product_name || 'Product'}</span>
                  <span className="text-xs text-gray-500">
                    Batch {b.batch_no} · Expiry {formatDate(b.expiry_date)}
                    {b.mrp !== null ? ` · MRP ${formatINR(b.mrp)}` : ''}
                    {b.cost_price !== null ? ` · Kharid ${formatINR(b.cost_price)}` : ''}
                  </span>
                </span>
                <span className="font-bold shrink-0">Qty {b.qty}</span>
                {b.qty > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleWriteOff(b)}
                    disabled={writeOffMut.isPending}
                    className="tap inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] text-xs font-bold disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Write Off
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
