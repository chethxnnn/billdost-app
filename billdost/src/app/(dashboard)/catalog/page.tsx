'use client'

import { useState, useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useTranslation } from '@/lib/i18n/useTranslation'
import MagicExtractModal from '@/components/dashboard/MagicExtractModal'

/* ─── Types ─── */
type Unit = 'piece' | 'kg' | 'g' | 'litre' | 'ml' | 'dozen' | 'pack' | 'service' | 'hour'

interface Product {
  id: string
  name: string
  description?: string | null
  category?: string | null
  hsn_code?: string | null
  unit: Unit
  price: number
  cost_price?: number | null
  tax_rate: number
  stock_qty?: number | null
  low_stock_alert?: number | null
  is_active: boolean
  sort_order: number
}

/* ─── Constants ─── */
const UNITS: { value: Unit; label: string }[] = [
  { value: 'piece',   label: 'Piece' },
  { value: 'kg',      label: 'Kg' },
  { value: 'g',       label: 'Gram' },
  { value: 'litre',   label: 'Litre' },
  { value: 'ml',      label: 'mL' },
  { value: 'dozen',   label: 'Dozen' },
  { value: 'pack',    label: 'Pack' },
  { value: 'service', label: 'Service' },
  { value: 'hour',    label: 'Hour' },
]

const GST_RATES = [0, 5, 12, 18, 28]

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

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

/* ─── Low stock badge ─── */
function LowStockBadge({ t }: { t: any }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-[#2E1A10] text-red-600 dark:text-[#E8622A]">
      ⚠ {t('catalog', 'low_stock')}
    </span>
  )
}

/* ─── Product Card ─── */
function ProductCard({
  product,
  onEdit,
  onDelete,
  t,
}: {
  product: Product
  onEdit: (p: Product) => void
  onDelete: (id: string) => void
  t: any
}) {
  const [bg, text] = avatarColor(product.name)
  const isLowStock =
    product.stock_qty !== null &&
    product.stock_qty !== undefined &&
    product.low_stock_alert !== null &&
    product.low_stock_alert !== undefined &&
    Number(product.stock_qty) <= Number(product.low_stock_alert)

  return (
    <div className="group bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-2xl p-4 hover:shadow-md dark:hover:border-[#3E3C38] transition-all duration-200 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
          style={{ background: bg, color: text }}
        >
          {product.name.charAt(0).toUpperCase()}
        </div>

        {/* Name + category */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-white truncate leading-tight">
            {product.name}
          </div>
          {product.category && (
            <div className="text-xs text-gray-400 dark:text-[#5C5A56] capitalize mt-0.5">
              {product.category}
            </div>
          )}
        </div>

        {/* Actions — show on hover */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(product)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#1B7A4A] dark:hover:text-[#2BB673] hover:bg-gray-50 dark:hover:bg-[#1E1C1A] transition-colors"
            title="Edit"
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-[#2E1A10] transition-colors"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-extrabold text-[#1B7A4A] dark:text-[#2BB673]">
            {formatINR(Number(product.price))}
          </div>
          <div className="text-xs text-gray-400 dark:text-[#5C5A56]">
            {t('catalog', 'per')} {product.unit}
            {product.tax_rate > 0 && ` · ${t('catalog', 'gst')} ${product.tax_rate}%`}
          </div>
        </div>

        {/* Stock */}
        {product.stock_qty !== null && product.stock_qty !== undefined ? (
          <div className="text-right">
            {isLowStock ? (
              <LowStockBadge t={t} />
            ) : (
              <span className="text-xs text-gray-500 dark:text-[#9A9690]">
                {t('catalog', 'stock')}: {product.stock_qty} {product.unit}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ─── Form defaults ─── */
const DEFAULT_FORM = {
  name: '',
  description: '',
  category: '',
  hsn_code: '',
  unit: 'piece' as Unit,
  price: 0,
  cost_price: undefined as number | undefined,
  tax_rate: 0,
  stock_qty: undefined as number | undefined,
  low_stock_alert: undefined as number | undefined,
  is_active: true,
}

/* ─── Product Drawer (Add / Edit) ─── */
function ProductDrawer({
  open,
  product,
  onClose,
  onSaved,
  t,
}: {
  open: boolean
  product: Product | null
  onClose: () => void
  onSaved: () => void
  t: any
}) {
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const drawerRef = useRef<HTMLDivElement>(null)

  const createMut = trpc.products.create.useMutation({ onSuccess: () => { onSaved(); onClose() } })
  const updateMut = trpc.products.update.useMutation({ onSuccess: () => { onSaved(); onClose() } })

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        description: product.description ?? '',
        category: product.category ?? '',
        hsn_code: product.hsn_code ?? '',
        unit: product.unit,
        price: Number(product.price),
        cost_price: product.cost_price !== null && product.cost_price !== undefined ? Number(product.cost_price) : undefined,
        tax_rate: Number(product.tax_rate),
        stock_qty: product.stock_qty !== null && product.stock_qty !== undefined ? Number(product.stock_qty) : undefined,
        low_stock_alert: product.low_stock_alert !== null && product.low_stock_alert !== undefined ? Number(product.low_stock_alert) : undefined,
        is_active: product.is_active,
      })
    } else {
      setForm({ ...DEFAULT_FORM })
    }
    setErrors({})
  }, [product, open])

  // Close on backdrop click
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name zaroori hai'
    if (form.price < 0) e.price = 'Price 0 ya zyada hona chahiye'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      category: form.category || null,
      hsn_code: form.hsn_code || null,
      unit: form.unit,
      price: form.price,
      cost_price: form.cost_price ?? null,
      tax_rate: form.tax_rate,
      stock_qty: form.stock_qty ?? null,
      low_stock_alert: form.low_stock_alert ?? null,
      is_active: form.is_active,
    }
    if (product) {
      updateMut.mutate({ id: product.id, ...payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending
  const saveError = createMut.error?.message || updateMut.error?.message

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-[#161513] border-l border-gray-100 dark:border-[#2E2C28] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#2E2C28] flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {product ? t('catalog', 'edit_product') : t('catalog', 'add_product')}
            </h2>
            <p className="text-xs text-gray-400 dark:text-[#5C5A56] mt-0.5">
              {product ? t('catalog', 'update_details') : t('catalog', 'add_to_catalog')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252320] transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
              {t('catalog', 'name')} *
            </label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Basmati Rice"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
              {t('catalog', 'category')}
            </label>
            <input
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              placeholder="e.g. Grains, Dairy, Snacks"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
            />
          </div>

          {/* Price + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
                {t('catalog', 'selling_price')} *
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.price || ''}
                onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
              />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
                {t('catalog', 'unit')}
              </label>
              <select
                value={form.unit}
                onChange={(e) => set('unit', e.target.value as Unit)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cost Price + GST */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
                {t('catalog', 'cost_price')}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.cost_price ?? ''}
                onChange={(e) => set('cost_price', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
                {t('catalog', 'gst_rate')}
              </label>
              <select
                value={form.tax_rate}
                onChange={(e) => set('tax_rate', Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
              >
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock + Low stock alert */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
                {t('catalog', 'stock_qty')}
              </label>
              <input
                type="number"
                min={0}
                value={form.stock_qty ?? ''}
                onChange={(e) => set('stock_qty', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder={t('catalog', 'skip_blank')}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
                {t('catalog', 'low_stock_alert')}
              </label>
              <input
                type="number"
                min={0}
                value={form.low_stock_alert ?? ''}
                onChange={(e) => set('low_stock_alert', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder={t('catalog', 'alert_below')}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
              />
            </div>
          </div>

          {/* HSN Code */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
              {t('catalog', 'hsn_code')} <span className="font-normal normal-case">{t('catalog', 'optional')}</span>
            </label>
            <input
              value={form.hsn_code}
              onChange={(e) => set('hsn_code', e.target.value)}
              placeholder="e.g. 1006"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-[#9A9690] uppercase tracking-wide mb-1.5">
              {t('catalog', 'description')} <span className="font-normal normal-case">{t('catalog', 'optional')}</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder={t('catalog', 'short_desc')}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1E1C1A] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors resize-none"
            />
          </div>

          {saveError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-[#2E1A10] text-red-600 dark:text-[#E8622A] text-xs">
              {saveError}
            </div>
          )}
        </form>

        {/* Footer */}
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
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : product ? t('catalog', 'update') : t('catalog', 'add')}
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Delete Confirm Modal ─── */
function DeleteModal({
  open,
  productName,
  onCancel,
  onConfirm,
  deleting,
  t
}: {
  open: boolean
  productName: string
  onCancel: () => void
  onConfirm: () => void
  deleting: boolean
  t: any
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-3xl mb-3">🗑️</div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
          {t('catalog', 'delete_confirm_title')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-[#9A9690] mb-5">
          <strong className="text-gray-900 dark:text-white">"{productName}"</strong> {t('catalog', 'delete_confirm_msg')}
        </p>
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
            {t('catalog', 'yes_delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Catalog Page ─── */
export default function CatalogPage() {
  const { t } = useTranslation()
  const [search, setSearch]             = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [editProduct, setEditProduct]   = useState<Product | null>(null)
  const [deleteId, setDeleteId]         = useState<string | null>(null)
  const [deleteName, setDeleteName]     = useState('')
  const [magicOpen, setMagicOpen]       = useState(false)

  const utils = trpc.useUtils()

  const { data: products, isLoading } = trpc.products.list.useQuery({
    search: search || undefined,
    category: activeCategory !== 'all' ? activeCategory : undefined,
    active: true,
  })

  const { data: categories } = trpc.products.categories.useQuery()

  const deleteMut = trpc.products.hardDelete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate()
      setDeleteId(null)
    },
  })

  const handleEdit = (p: Product) => { setEditProduct(p); setDrawerOpen(true) }
  const handleAdd  = () => { setEditProduct(null); setDrawerOpen(true) }
  const handleCloseDrawer = () => { setDrawerOpen(false); setEditProduct(null) }
  const handleSaved = () => { utils.products.list.invalidate(); utils.products.categories.invalidate() }

  const handleDeleteClick = (id: string, name: string) => { setDeleteId(id); setDeleteName(name) }
  const handleDeleteConfirm = () => { if (deleteId) deleteMut.mutate({ id: deleteId }) }

  const lowStockCount = (products ?? []).filter(
    (p) => p.stock_qty !== null && p.low_stock_alert !== null &&
           Number(p.stock_qty) <= Number(p.low_stock_alert)
  ).length

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {t('catalog', 'title')} 📦
          </h1>
          <p className="text-sm text-gray-400 dark:text-[#5C5A56] mt-0.5">
            {isLoading ? '...' : `${products?.length ?? 0} ${t('catalog', 'total_products')}`}
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-500 dark:text-[#E8622A] font-medium">
                · {lowStockCount} low stock
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMagicOpen(true)}
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1B7A4A] to-[#25D366] hover:from-[#155F3A] hover:to-[#1B7A4A] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-[#25D366]/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>✨</span> Magic Extract
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2E2C28] text-gray-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-all active:scale-[0.98] shadow-sm"
          >
            <span className="text-base">+</span>
            {t('catalog', 'add_product')}
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5C5A56] w-4 h-4 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('catalog', 'search_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5C5A56] outline-none focus:border-[#1B7A4A] dark:focus:border-[#2BB673] transition-colors"
          />
        </div>

        {/* Category tabs */}
        {categories && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {['all', ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-[#1B7A4A] text-white shadow-sm'
                    : 'bg-white dark:bg-[#161513] border border-gray-200 dark:border-[#2E2C28] text-gray-600 dark:text-[#9A9690] hover:border-gray-300 dark:hover:border-[#3E3C38]'
                }`}
              >
                {cat === 'all' ? t('catalog', 'all') : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#161513] border border-gray-100 dark:border-[#2E2C28] rounded-2xl p-4 space-y-3">
              <div className="flex gap-3">
                <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : !products || products.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {search || activeCategory !== 'all' ? t('catalog', 'no_products_found') : t('catalog', 'catalog_empty')}
          </h3>
          <p className="text-sm text-gray-400 dark:text-[#5C5A56] mb-6 max-w-xs">
            {search || activeCategory !== 'all'
              ? t('catalog', 'remove_filter')
              : t('catalog', 'add_first')}
          </p>
          {!search && activeCategory === 'all' && (
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#1B7A4A]/20"
            >
              {t('catalog', 'add_first_btn')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p as Product}
              onEdit={handleEdit}
              onDelete={(id) => handleDeleteClick(id, p.name)}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Drawer */}
      <ProductDrawer
        open={drawerOpen}
        product={editProduct}
        onClose={handleCloseDrawer}
        onSaved={handleSaved}
        t={t}
      />

      {/* Delete confirm */}
      <DeleteModal
        open={!!deleteId}
        productName={deleteName}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleteMut.isPending}
        t={t}
      />

      {/* Magic Extract Modal */}
      <MagicExtractModal 
        open={magicOpen} 
        onClose={() => setMagicOpen(false)} 
        onSaved={handleSaved} 
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

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
