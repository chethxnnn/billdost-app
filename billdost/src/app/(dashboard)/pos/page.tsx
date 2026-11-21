'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Minus, PauseCircle, PlayCircle, Plus, ScanLine, Trash2 } from 'lucide-react'
import { QuickAddGrid } from '@/components/invoices/QuickAddGrid'
import { BarcodeScanner } from '@/components/shared/BarcodeScanner'
import { ErrorFallback } from '@/components/shared/ErrorFallback'
import { computeTotals, stateCodeFromGstin } from '@/lib/money'
import { stateCodeForName } from '@/lib/indian-states'

interface PosLine {
  product_id: string
  name: string
  unit_price: number
  tax_rate: number
  quantity: number
}

interface Hold {
  id: string
  label: string
  lines: PosLine[]
  customer_name: string
  saved_at: string
}

type PayChoice = 'cash' | 'upi' | 'udhaar'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

const HOLDS_KEY = 'billdost_pos_holds'

function readHolds(): Hold[] {
  try {
    const raw = localStorage.getItem(HOLDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * POS counter mode (blueprint D4): one continuous surface built for
 * speed. Product taps and barcode scans fill the bill, totals come
 * from the same money engine as the invoice form, and Complete goes
 * through the exact same invoices.create RPC path with source 'pos'.
 * No parallel money logic exists here by design.
 */
export default function PosPage() {
  const utils = trpc.useUtils()
  const { data: shopSettings, error: shopError, refetch } = trpc.invoices.getShopSettings.useQuery()
  const createMut = trpc.invoices.create.useMutation()

  const [lines, setLines] = useState<PosLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [payChoice, setPayChoice] = useState<PayChoice>('cash')
  const [barcodeText, setBarcodeText] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [holds, setHolds] = useState<Hold[]>([])
  const [holdsOpen, setHoldsOpen] = useState(false)
  const [done, setDone] = useState<{ id: string; number: string } | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHolds(readHolds())
  }, [])

  const totals = useMemo(
    () =>
      computeTotals({
        items: lines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        })),
        discount_pct: 0,
        shop_state_code:
          stateCodeForName((shopSettings as any)?.state) ||
          stateCodeFromGstin(shopSettings?.gstin),
        customer_state_code: null,
        customer_gstin: null,
        is_gst_registered: Boolean(shopSettings?.gstin),
        round_off: true,
      }),
    [lines, shopSettings]
  )

  const addProduct = (product: any) => {
    setDone(null)
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product_id === product.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          unit_price: Number(product.price),
          tax_rate: Number(product.tax_rate || 0),
          quantity: 1,
        },
      ]
    })
  }

  const handleBarcode = async (code: string) => {
    setScannerOpen(false)
    setBarcodeText('')
    try {
      const product = await utils.products.getByBarcode.fetch({ barcode: code })
      if (product) {
        addProduct(product)
        toast.success(`${product.name} add ho gaya`)
      } else {
        toast.error(`Barcode ${code} kisi product par nahi hai.`, { duration: 4000 })
      }
    } catch {
      toast.error('Barcode lookup nahi ho paya.')
    }
    barcodeRef.current?.focus()
  }

  const changeQty = (productId: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.product_id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  const resetBill = () => {
    setLines([])
    setCustomerName('')
    setCustomerPhone('')
    setPayChoice('cash')
    setDone(null)
  }

  const saveHold = () => {
    if (lines.length === 0) return
    const hold: Hold = {
      id: `${Date.now()}`,
      label: customerName.trim() || `Bill ${holds.length + 1}`,
      lines,
      customer_name: customerName,
      saved_at: new Date().toISOString(),
    }
    const next = [...holds, hold]
    setHolds(next)
    localStorage.setItem(HOLDS_KEY, JSON.stringify(next))
    resetBill()
    toast.success('Bill hold par rakh diya')
  }

  const resumeHold = (hold: Hold) => {
    setLines(hold.lines)
    setCustomerName(hold.customer_name)
    const next = holds.filter((h) => h.id !== hold.id)
    setHolds(next)
    localStorage.setItem(HOLDS_KEY, JSON.stringify(next))
    setHoldsOpen(false)
    setDone(null)
  }

  const complete = async () => {
    if (lines.length === 0 || createMut.isPending) return
    try {
      const paid = payChoice === 'udhaar' ? 0 : totals.total
      const result = await createMut.mutateAsync({
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim() || null,
        invoice_date: new Date().toISOString().split('T')[0],
        discount_pct: 0,
        amount_paid_at_creation: paid,
        payment_mode: payChoice === 'udhaar' ? null : payChoice,
        include_upi_qr: true,
        source: 'pos',
        items: lines.map((l) => ({
          product_id: l.product_id,
          name: l.name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        })),
      })
      setDone({ id: result.id, number: result.invoice_number })
      setLines([])
      setCustomerName('')
      setCustomerPhone('')
      toast.success(`Bill ${result.invoice_number} ban gaya!`)
    } catch (err: any) {
      toast.error(err.message || 'Bill nahi ban paya. Dobara try karo.')
    }
  }

  // Counter keyboard map (blueprint D4): F2 jumps to the barcode
  // field, F9 completes the bill.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        barcodeRef.current?.focus()
      }
      if (e.key === 'F9') {
        e.preventDefault()
        void complete()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // complete reads the latest state through the mutation closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, payChoice, customerName, customerPhone, totals.total])

  if (shopError) {
    return (
      <ErrorFallback
        error={new Error(shopError.message)}
        onRetry={() => void refetch()}
        variant="inline"
      />
    )
  }

  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-4">
      {/* Minimal chrome: title, holds, exit */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          POS Counter
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHoldsOpen((o) => !o)}
            aria-expanded={holdsOpen}
            className="tap inline-flex items-center gap-2 min-h-[48px] px-4 rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] font-bold text-sm"
          >
            <PauseCircle className="w-4 h-4" aria-hidden="true" />
            Hold Wale Bills ({holds.length})
          </button>
          <Link
            href="/dashboard"
            className="tap inline-flex items-center min-h-[48px] px-4 rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] font-bold text-sm"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {holdsOpen && (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4 space-y-2">
          {holds.length === 0 ? (
            <p className="text-sm text-gray-500">Koi hold wala bill nahi hai.</p>
          ) : (
            holds.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#2C2C2E]">
                <span className="text-sm font-semibold truncate">
                  {h.label} · {h.lines.length} items
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => resumeHold(h)}
                    className="tap inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full bg-[#1B7A4A] text-white text-sm font-bold"
                  >
                    <PlayCircle className="w-4 h-4" aria-hidden="true" /> Wapas Lao
                  </button>
                  <button
                    type="button"
                    aria-label={`${h.label} hold hatao`}
                    onClick={() => {
                      const next = holds.filter((x) => x.id !== h.id)
                      setHolds(next)
                      localStorage.setItem(HOLDS_KEY, JSON.stringify(next))
                    }}
                    className="tap w-11 h-11 rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Barcode first (D2 + D4): wedge scanners type here and Enter. */}
      <div className="flex gap-2">
        <input
          ref={barcodeRef}
          type="text"
          value={barcodeText}
          onChange={(e) => setBarcodeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const code = barcodeText.trim()
              if (code) void handleBarcode(code)
            }
          }}
          placeholder="Barcode scan karo ya type karke Enter (F2)"
          aria-label="Barcode"
          className="flex-1 min-h-[52px] px-4 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl text-[15px] outline-none focus:border-[#1B7A4A]"
        />
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="tap inline-flex items-center gap-2 min-h-[52px] px-5 rounded-2xl bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold transition-colors"
        >
          <ScanLine className="w-5 h-5" aria-hidden="true" />
          Camera Scan
        </button>
      </div>
      {scannerOpen && (
        <BarcodeScanner onDetected={(code) => void handleBarcode(code)} onClose={() => setScannerOpen(false)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Product pane */}
        <div className="lg:col-span-3 min-h-[420px]">
          <QuickAddGrid large onAddProduct={addProduct} />
        </div>

        {/* Bill pane */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4 space-y-4 lg:sticky lg:top-4">
          {done ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                Bill {done.number} ready hai!
              </p>
              <div className="grid grid-cols-1 gap-2">
                <a
                  href={`/print/invoice/${done.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tap inline-flex items-center justify-center min-h-[52px] rounded-2xl bg-[#1B7A4A] text-white font-bold"
                >
                  Thermal Print Karo
                </a>
                <Link
                  href={`/invoices/${done.id}`}
                  className="tap inline-flex items-center justify-center min-h-[52px] rounded-2xl bg-[#25D366]/15 text-[#1B7A4A] dark:text-[#25D366] font-bold"
                >
                  WhatsApp Par Bhejo
                </Link>
                <button
                  type="button"
                  onClick={resetBill}
                  className="tap min-h-[52px] rounded-2xl border border-gray-200 dark:border-[#38383A] font-bold"
                >
                  Naya Bill (Next Customer)
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer naam (Walk-in)"
                  aria-label="Customer naam"
                  className="min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  aria-label="Customer phone"
                  className="min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
                />
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {lines.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    Item tap karo ya barcode scan karo, bill yahan banta jayega.
                  </p>
                ) : (
                  lines.map((l) => (
                    <div key={l.product_id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#2C2C2E]">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold truncate">{l.name}</span>
                        <span className="block text-xs text-gray-500">{formatINR(l.unit_price)} each</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`${l.name} quantity kam karo`}
                        onClick={() => changeQty(l.product_id, -1)}
                        className="tap w-11 h-11 rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center font-extrabold">{l.quantity}</span>
                      <button
                        type="button"
                        aria-label={`${l.name} quantity badhao`}
                        onClick={() => changeQty(l.product_id, 1)}
                        className="tap w-11 h-11 rounded-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <span className="w-20 text-right font-bold text-sm">
                        {formatINR(l.unit_price * l.quantity)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-[#38383A] pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Tax (GST)</span>
                  <span>{formatINR(totals.tax_amt)}</span>
                </div>
                <div className="flex justify-between text-lg font-extrabold text-gray-900 dark:text-white">
                  <span>Total</span>
                  <span>{formatINR(totals.total)}</span>
                </div>
              </div>

              {/* Big payment pills */}
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment">
                {(
                  [
                    { key: 'cash', label: 'Cash Paid' },
                    { key: 'upi', label: 'UPI Paid' },
                    { key: 'udhaar', label: 'Udhaar' },
                  ] as Array<{ key: PayChoice; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={payChoice === opt.key}
                    onClick={() => setPayChoice(opt.key)}
                    className={`tap min-h-[52px] rounded-2xl font-bold text-sm transition-colors ${
                      payChoice === opt.key
                        ? 'bg-[#1D1D1F] dark:bg-white text-white dark:text-black'
                        : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveHold}
                  disabled={lines.length === 0}
                  className="tap min-h-[56px] px-4 rounded-2xl border border-gray-200 dark:border-[#38383A] font-bold disabled:opacity-40"
                >
                  Hold
                </button>
                <button
                  type="button"
                  onClick={() => void complete()}
                  disabled={lines.length === 0 || createMut.isPending}
                  className="tap flex-1 min-h-[56px] rounded-2xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-40 text-white text-[16px] font-extrabold transition-colors"
                >
                  {createMut.isPending ? 'Ban raha hai...' : `Bill Banao · ${formatINR(totals.total)} (F9)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
