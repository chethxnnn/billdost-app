'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Pencil, Plus, XCircle } from 'lucide-react'
import { ErrorFallback } from '@/components/shared/ErrorFallback'
import { useShop } from '@/components/shared/ShopContext'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Kiraya (Rent)',
  salary: 'Salary',
  electricity: 'Bijli (Electricity)',
  transport: 'Transport',
  packaging: 'Packaging',
  tea_food: 'Chai-Nashta',
  other: 'Other',
}

const categoryLabel = (c: string) => CATEGORY_LABELS[c] || c

interface ExpenseRow {
  id: string
  category: string
  amount: number
  expense_date: string
  mode: string
  status: string
  note: string | null
}

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const todayStr = () => new Date().toISOString().split('T')[0]

/**
 * Expenses (blueprint D11): the shop's own kharcha book. Totals and
 * the analytics cash snapshot come from the same rows; cancelled
 * expenses stay visible on demand but never count.
 */
export default function ExpensesPage() {
  const { role } = useShop()
  const canManage = role !== 'cashier'
  const utils = trpc.useUtils()

  const [month, setMonth] = useState(currentMonth())
  const [showCancelled, setShowCancelled] = useState(false)
  const listQuery = trpc.expenses.list.useQuery({ month, includeCancelled: showCancelled })
  const categoriesQuery = trpc.expenses.listCategories.useQuery()
  const profitQuery = trpc.analytics.monthlyProfit.useQuery(undefined, { enabled: canManage })

  const createMut = trpc.expenses.create.useMutation()
  const updateMut = trpc.expenses.update.useMutation()
  const cancelMut = trpc.expenses.cancel.useMutation()
  const addCategoryMut = trpc.expenses.addCategory.useMutation()

  const [form, setForm] = useState({
    category: 'other',
    amount: '',
    expense_date: todayStr(),
    mode: 'cash' as 'cash' | 'upi' | 'bank',
    note: '',
  })
  const [newCategory, setNewCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const expenses = (listQuery.data?.expenses || []) as ExpenseRow[]
  const topCategories = useMemo(() => {
    const entries = Object.entries(listQuery.data?.byCategory || {}) as Array<[string, number]>
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [listQuery.data])

  const refresh = () => {
    void utils.expenses.list.invalidate()
    void utils.analytics.monthlyProfit.invalidate()
  }

  const resetForm = () => {
    setForm({ category: 'other', amount: '', expense_date: todayStr(), mode: 'cash', note: '' })
    setEditingId(null)
  }

  const handleSubmit = async () => {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) {
      toast.error('Sahi amount daalo.')
      return
    }
    const payload = {
      category: form.category,
      amount,
      expense_date: form.expense_date,
      mode: form.mode,
      note: form.note.trim() || null,
    }
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, ...payload })
        toast.success('Expense update ho gaya.')
      } else {
        await createMut.mutateAsync(payload)
        toast.success('Expense jud gaya.')
      }
      resetForm()
      refresh()
    } catch (err: any) {
      toast.error(err.message || 'Expense save nahi ho paya.')
    }
  }

  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    try {
      await addCategoryMut.mutateAsync({ name })
      toast.success('Category jud gayi.')
      setNewCategory('')
      setForm((f) => ({ ...f, category: name }))
      void utils.expenses.listCategories.invalidate()
    } catch (err: any) {
      toast.error(err.message || 'Category nahi jud payi.')
    }
  }

  const handleCancel = async (row: ExpenseRow) => {
    try {
      await cancelMut.mutateAsync({ id: row.id })
      toast.success('Expense cancel kar diya. Total se hat gaya hai.')
      refresh()
    } catch (err: any) {
      toast.error(err.message || 'Cancel nahi ho paya.')
    }
  }

  if (listQuery.error) {
    return (
      <ErrorFallback
        error={new Error(listQuery.error.message)}
        onRetry={() => void listQuery.refetch()}
        variant="inline"
      />
    )
  }

  const profit = profitQuery.data

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Kharcha</h1>
          <p className="text-gray-500 dark:text-[#98989D] mt-1 text-[15px]">
            Dukaan ke kharche yahan likho, mahine ka hisaab apne aap banega.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
          Mahina
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            aria-label="Mahina chuno"
            className="min-h-[48px] px-3 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
        </label>
      </div>

      {/* Cash snapshot: received minus expenses, honestly labelled */}
      {canManage && profit && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Is Mahine Aaya (Payments)</p>
            <p className="text-2xl font-extrabold mt-1 text-gray-900 dark:text-white">{formatINR(profit.received)}</p>
          </div>
          <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Is Mahine Kharcha</p>
            <p className="text-2xl font-extrabold mt-1 text-gray-900 dark:text-white">{formatINR(profit.expenses)}</p>
          </div>
          <div className="bg-[#1D1D1F] dark:bg-white text-white dark:text-black rounded-3xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">Net Cash</p>
            <p className="text-2xl font-extrabold mt-1">{formatINR(profit.net)}</p>
            <p className="text-xs opacity-70 mt-1">Cash view hai: paisa jab aaya tab gina, udhaar wala bill payment par ginega.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Add / edit form */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-5 space-y-3 lg:sticky lg:top-4">
          <h2 className="font-extrabold text-gray-900 dark:text-white">
            {editingId ? 'Expense Edit Karo' : 'Naya Kharcha Jodo'}
          </h2>
          <div>
            <label htmlFor="exp-category" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Category</label>
            <select
              id="exp-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
            >
              {(categoriesQuery.data?.all || ['other']).map((c) => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Apni category banao"
                aria-label="Nayi category ka naam"
                className="flex-1 min-h-[44px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
              />
              <button
                type="button"
                onClick={() => void handleAddCategory()}
                disabled={!newCategory.trim() || addCategoryMut.isPending}
                className="tap inline-flex items-center gap-1 min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-[#38383A] text-sm font-bold disabled:opacity-40"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> Jodo
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="exp-amount" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Amount (Rs)</label>
              <input
                id="exp-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
              />
            </div>
            <div>
              <label htmlFor="exp-date" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date</label>
              <input
                id="exp-date"
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="w-full min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
              />
            </div>
          </div>
          <div className="flex gap-1" role="radiogroup" aria-label="Payment mode">
            {(['cash', 'upi', 'bank'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={form.mode === m}
                onClick={() => setForm({ ...form, mode: m })}
                className={`tap flex-1 min-h-[44px] rounded-full text-sm font-bold capitalize ${
                  form.mode === m
                    ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-black'
                    : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Note (optional)"
            aria-label="Note"
            className="w-full min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={createMut.isPending || updateMut.isPending}
              className="tap flex-1 min-h-[52px] rounded-2xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-50 text-white font-bold transition-colors"
            >
              {editingId ? 'Update Karo' : 'Kharcha Jodo'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="tap min-h-[52px] px-4 rounded-2xl border border-gray-200 dark:border-[#38383A] font-bold"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-extrabold text-gray-900 dark:text-white">
              Mahine ka Kul Kharcha: {formatINR(listQuery.data?.total || 0)}
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
                className="w-4 h-4 accent-[#1B7A4A]"
              />
              Cancel wale bhi dikhao
            </label>
          </div>
          {topCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topCategories.map(([cat, amt]) => (
                <span key={cat} className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-200">
                  {categoryLabel(cat)}: {formatINR(amt)}
                </span>
              ))}
            </div>
          )}
          {listQuery.isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 dark:bg-[#2C2C2E] rounded-2xl h-16 w-full" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-8 text-center">
              <p className="font-bold text-gray-900 dark:text-white">Is mahine koi kharcha nahi likha</p>
              <p className="text-sm text-gray-500 mt-1">Pehla kharcha left form se jodo.</p>
            </div>
          ) : (
            expenses.map((row) => (
              <div
                key={row.id}
                className={`bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-2xl px-4 py-3 flex items-center gap-3 ${
                  row.status === 'cancelled' ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                    {categoryLabel(row.category)}
                    {row.status === 'cancelled' && (
                      <span className="ml-2 text-[11px] uppercase tracking-wide text-red-500">Cancelled</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {new Date(`${row.expense_date}T00:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    · {row.mode}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                </div>
                <span className="font-extrabold text-gray-900 dark:text-white">{formatINR(row.amount)}</span>
                {canManage && row.status === 'active' && (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Expense edit karo"
                      onClick={() => {
                        setEditingId(row.id)
                        setForm({
                          category: row.category,
                          amount: String(row.amount),
                          expense_date: row.expense_date,
                          mode: (row.mode as 'cash' | 'upi' | 'bank') || 'cash',
                          note: row.note || '',
                        })
                      }}
                      className="tap w-11 h-11 rounded-full bg-gray-50 dark:bg-[#2C2C2E] flex items-center justify-center text-gray-500"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Expense cancel karo"
                      onClick={() => void handleCancel(row)}
                      disabled={cancelMut.isPending}
                      className="tap w-11 h-11 rounded-full bg-gray-50 dark:bg-[#2C2C2E] flex items-center justify-center text-gray-500 hover:text-red-500"
                    >
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
