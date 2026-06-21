'use client'

import { useState, useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import CustomerAnalyticsDrawer from '@/components/customers/CustomerAnalyticsDrawer'

/* ─── Types ─── */
interface Customer {
  id: string
  name: string
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  tags?: string[] | null
  total_billed: number
  total_paid: number
  bill_count: number
  last_billed?: string | null
}

/* ─── Constants & Helpers ─── */
const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const avatarColor = (name: string) => {
  const colors = [
    ['#0D2E1F', '#2BB673'], ['#1a1a2e', '#4361ee'], ['#2d1b00', '#f48c06'],
    ['#1a0a0a', '#e63946'], ['#0a1a2d', '#4cc9f0'], ['#1a0d2e', '#7b2d8b'],
  ]
  return colors[name.charCodeAt(0) % colors.length]
}

/* ─── Skeleton ─── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 dark:bg-[#2E2C28] ${className}`} />
}

/* ─── Customer Card ─── */
function CustomerCard({
  customer,
  onEdit,
  onDelete,
  onViewAnalytics,
  t,
}: {
  customer: Customer
  onEdit: (c: Customer) => void
  onDelete: (id: string) => void
  onViewAnalytics: (id: string) => void
  t: any
}) {
  const [bg, text] = avatarColor(customer.name)

  return (
    <div 
      onClick={() => onViewAnalytics(customer.id)}
      className="group bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-2xl p-4 hover:shadow-md dark:hover:border-[#3E3C38] transition-all duration-200 flex flex-col gap-4 cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: bg, color: text }}
        >
          {customer.name.charAt(0).toUpperCase()}
        </div>

        {/* Name + phone */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
            {customer.name}
          </div>
          {customer.phone && (
            <div className="text-xs text-gray-500 dark:text-[#9A9690] mt-0.5">
              {customer.phone}
            </div>
          )}
        </div>

        {/* Actions — show on hover */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(customer); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#1B7A4A] dark:hover:text-[#2BB673] hover:bg-gray-50 dark:hover:bg-[#1E1C1A] transition-colors"
            title="Edit"
          >
            <PencilIcon />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(customer.id); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#2E1A10] transition-colors"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Tags */}
      {customer.tags && customer.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customer.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 bg-gray-50 dark:bg-[#252320] text-gray-600 dark:text-[#9A9690] rounded-full text-[10px] font-semibold tracking-wide uppercase">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 dark:border-[#2E2C28]">
        <div>
          <div className="text-[10px] font-semibold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-0.5">
            {t('customers', 'total_billed')}
          </div>
          <div className="text-sm font-extrabold text-gray-900 dark:text-white">
            {formatINR(Number(customer.total_billed))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold text-gray-400 dark:text-[#5C5A56] uppercase tracking-wider mb-0.5">
            {t('customers', 'bills')}
          </div>
          <div className="text-sm font-extrabold text-gray-900 dark:text-white">
            {customer.bill_count}
          </div>
        </div>
      </div>

      {/* WhatsApp Button */}
      {customer.whatsapp || customer.phone ? (
        <a
          onClick={(e) => e.stopPropagation()}
          href={`https://wa.me/91${(customer.whatsapp || customer.phone)?.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 w-full py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <WhatsAppIcon className="w-4 h-4" />
          {t('customers', 'msg_whatsapp')}
        </a>
      ) : null}
    </div>
  )
}

/* ─── Form defaults ─── */
const DEFAULT_FORM = {
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  notes: '',
  tags: [] as string[],
}

/* ─── Customer Drawer (Add / Edit) ─── */
function CustomerDrawer({
  open,
  customer,
  onClose,
  onSaved,
  t,
}: {
  open: boolean
  customer: Customer | null
  onClose: () => void
  onSaved: () => void
  t: any
}) {
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const drawerRef = useRef<HTMLDivElement>(null)

  const createMut = trpc.customers.create.useMutation({ onSuccess: () => { onSaved(); onClose() } })
  const updateMut = trpc.customers.update.useMutation({ onSuccess: () => { onSaved(); onClose() } })

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone ?? '',
        whatsapp: customer.whatsapp ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        notes: customer.notes ?? '',
        tags: customer.tags ?? [],
      })
    } else {
      setForm({ ...DEFAULT_FORM })
    }
    setTagInput('')
    setErrors({})
  }, [customer, open])

  // Close on backdrop click
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!form.tags.includes(tagInput.trim().toLowerCase())) {
        set('tags', [...form.tags, tagInput.trim().toLowerCase()])
      }
      setTagInput('')
    }
  }

  const removeTag = (t: string) => set('tags', form.tags.filter((x) => x !== t))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Naam zaroori hai'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      tags: form.tags,
    }
    if (customer) {
      updateMut.mutate({ id: customer.id, ...payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending
  const saveError = createMut.error?.message || updateMut.error?.message

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-[#161513] border-l border-gray-100 dark:border-[#2E2C28] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#2E2C28] flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {customer ? t('customers', 'edit_customer') : t('customers', 'add_customer')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252320] transition-colors"
          >
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">{t('customers', 'name')} *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Raju Bhai..."
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">{t('customers', 'phone')}</label>
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="98765..."
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">{t('customers', 'whatsapp')}</label>
              <input
                value={form.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
                placeholder="Optional..."
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">{t('customers', 'tags_label')}</label>
            <div className="p-2 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl focus-within:border-[#1B7A4A] dark:focus-within:border-[#2BB673] transition-colors">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#252320] border border-gray-200 dark:border-[#3E3C38] rounded-lg text-xs font-medium">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="text-gray-400 hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="e.g. VIP, Regular, Udhaar..."
                className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none px-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">{t('customers', 'address')}</label>
            <textarea
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">{t('customers', 'notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors resize-none"
            />
          </div>

          {saveError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-[#2E1A10] text-red-600 dark:text-[#E8622A] text-xs">
              {saveError}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#2E2C28] flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[#2E2C28] text-sm font-medium text-gray-600 dark:text-[#9A9690] hover:bg-gray-50 dark:hover:bg-[#1E1C1A] transition-colors"
          >
            {t('common', 'cancel')}
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:bg-[#1B7A4A]/50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {customer ? t('customers', 'update') : t('customers', 'add')}
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Delete Confirm Modal ─── */
function DeleteModal({
  open,
  name,
  onCancel,
  onConfirm,
  deleting,
  error,
  t,
}: {
  open: boolean
  name: string
  onCancel: () => void
  onConfirm: () => void
  deleting?: boolean
  error?: string | null
  t: any
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-3xl mb-3">🗑️</div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
          {t('customers', 'delete_confirm_title')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-[#9A9690] mb-5">
          <strong className="text-gray-900 dark:text-white">"{name}"</strong> {t('customers', 'delete_confirm_msg')}
        </p>
        {error && <div className="mb-4 text-xs text-red-500 bg-red-50 dark:bg-[#2E1A10] p-2 rounded-lg">{error}</div>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[#2E2C28] text-sm font-medium text-gray-600 dark:text-[#9A9690] hover:bg-gray-50 dark:hover:bg-[#1E1C1A] transition-colors"
          >
            {t('common', 'cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {deleting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {t('customers', 'delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Customers Page ─── */
export default function CustomersPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [analyticsId, setAnalyticsId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const utils = trpc.useUtils()

  const { data: customers, isLoading } = trpc.customers.list.useQuery({
    search: search || undefined,
  })

  const deleteMut = trpc.customers.delete.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate()
      setDeleteId(null)
    },
  })

  const createManyMut = trpc.customers.createMany.useMutation({
    onSuccess: (res) => {
      utils.customers.list.invalidate()
      toast.success(`Success! Imported ${res.imported} customers. Skipped ${res.skipped} duplicates.`)
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err) => {
      toast.error(`Import failed: ${err.message}`)
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws) as any[]

        if (data.length === 0) {
          toast.error("The file appears to be empty.")
          setIsImporting(false)
          return
        }

        const formattedData = data.map((row: any) => {
          // Auto-map common column names (case-insensitive)
          const getField = (keys: string[]) => {
            const key = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()))
            return key ? String(row[key]).trim() : ''
          }

          const name = getField(['name', 'contact name', 'customer name', 'customer', 'full name'])
          const phone = getField(['phone', 'mobile', 'phone number', 'contact number', 'contact']) || null
          const whatsapp = getField(['whatsapp', 'whatsapp number']) || phone || null
          const email = getField(['email', 'email address']) || null
          const address = getField(['address', 'location', 'city']) || null
          const notes = getField(['notes', 'remark', 'remarks']) || null

          return { name, phone, whatsapp, email, address, notes, tags: [] }
        }).filter(c => c.name) // name is mandatory

        if (formattedData.length === 0) {
          toast.error("Could not find a 'Name' column in the file.")
          setIsImporting(false)
          return
        }

        createManyMut.mutate(formattedData)
      } catch (err: any) {
        toast.error("Failed to read file. Make sure it's a valid CSV or Excel file.")
        setIsImporting(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleEdit = (c: Customer) => { setEditCustomer(c); setDrawerOpen(true) }
  const handleAdd  = () => { setEditCustomer(null); setDrawerOpen(true) }
  const handleCloseDrawer = () => { setDrawerOpen(false); setEditCustomer(null) }
  const handleSaved = () => { utils.customers.list.invalidate() }

  const handleDeleteClick = (id: string, name: string) => { setDeleteId(id); setDeleteName(name); deleteMut.reset() }
  const handleDeleteConfirm = () => { if (deleteId) deleteMut.mutate({ id: deleteId }) }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {t('customers', 'title')} 🤝
          </h1>
          <p className="text-sm text-gray-400 dark:text-[#5C5A56] mt-0.5">
            {isLoading ? '...' : `${customers?.length ?? 0} ${t('customers', 'total_customers')}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-[#252320] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
          >
            {isImporting ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <span>📄</span>}
            Import CSV
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#1B7A4A]/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="text-base">+</span>
            {t('customers', 'add_customer')}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Search */}
        <div className="relative w-full max-w-md">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5C5A56] w-4 h-4 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('customers', 'search_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
          />
        </div>

        {/* View Toggle */}
        <div className="flex p-1 bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-xl shadow-sm shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'grid' 
                ? 'bg-[#1B7A4A] text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-900 dark:text-[#9A9690] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#252320]'
            }`}
          >
            <GridIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'list' 
                ? 'bg-[#1B7A4A] text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-900 dark:text-[#9A9690] dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#252320]'
            }`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-2xl p-4 space-y-3">
              <div className="flex gap-3">
                <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2 mt-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-10 w-full rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : !customers || customers.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">🙌</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {search ? t('customers', 'no_customers_found') : t('customers', 'customer_list_empty')}
          </h3>
          <p className="text-sm text-gray-400 dark:text-[#5C5A56] mb-6 max-w-xs">
            {search ? t('customers', 'remove_filter') : t('customers', 'add_first')}
          </p>
          {!search && (
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#1B7A4A]/20"
            >
              {t('customers', 'add_first_btn')}
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {customers.map((c) => (
            <CustomerCard
              key={c.id}
              customer={c as Customer}
              onEdit={handleEdit}
              onDelete={(id) => handleDeleteClick(id, c.name)}
              onViewAnalytics={setAnalyticsId}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-2xl overflow-hidden shadow-sm overflow-x-auto hide-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-[#1C1C1E] border-b border-gray-100 dark:border-[#2E2C28]">
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Customer Name</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Contact</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Total Billed</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Bills</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2E2C28]">
              {customers.map((c) => {
                const [bg, text] = avatarColor(c.name)
                return (
                  <tr 
                    key={c.id} 
                    onClick={() => setAnalyticsId(c.id)}
                    className="hover:bg-gray-50/50 dark:hover:bg-[#252320] transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: bg, color: text }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-bold text-sm text-gray-900 dark:text-white">{c.name}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-600 dark:text-[#9A9690]">{c.phone || '-'}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="text-sm font-extrabold text-gray-900 dark:text-white">{formatINR(Number(c.total_billed))}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="text-sm font-bold text-gray-600 dark:text-[#9A9690]">{c.bill_count}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(c as Customer); }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#1B7A4A] dark:hover:text-[#2BB673] hover:bg-gray-50 dark:hover:bg-[#1E1C1A] transition-colors"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(c.id, c.name); }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#2E1A10] transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Drawer */}
      <CustomerDrawer
        open={drawerOpen}
        customer={editCustomer}
        onClose={handleCloseDrawer}
        onSaved={handleSaved}
        t={t}
      />

      {/* Delete confirm */}
      <DeleteModal
        open={!!deleteId}
        name={deleteName}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleteMut.isPending}
        error={deleteMut.error?.message}
        t={t}
      />

      {/* Analytics Drawer */}
      <CustomerAnalyticsDrawer
        customerId={analyticsId}
        open={!!analyticsId}
        onClose={() => setAnalyticsId(null)}
      />
    </div>
  )
}

/* ─── Icons ─── */
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
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
