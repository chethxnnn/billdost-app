'use client'

import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { AlertTriangle, Send } from 'lucide-react'
import { ErrorFallback } from '@/components/shared/ErrorFallback'

interface LowProduct {
  id: string
  name: string
  stock_qty: number | null
  low_stock_alert: number | null
  unit?: string | null
}

/**
 * Low-stock centre (blueprint D20): the complete, correct list of
 * products at or below their alert level (the dashboard tile shows
 * the same data, trimmed). The owner can send the WhatsApp digest
 * to their own number through the official Cloud API; the send
 * refuses honestly when alerts are off, nothing is low, the shop
 * has no phone, or WhatsApp is not connected.
 */
export default function LowStockPage() {
  const utils = trpc.useUtils()
  const listQuery = trpc.products.lowStock.useQuery()
  const settingsQuery = trpc.settings.getShopSettings.useQuery()
  const digestMut = trpc.whatsapp.sendLowStockDigest.useMutation()
  const toggleMut = trpc.settings.updateLowStockAlerts.useMutation()

  const items = (listQuery.data || []) as unknown as LowProduct[]
  const alertsOn = (settingsQuery.data as any)?.low_stock_alerts !== false

  const handleDigest = async () => {
    try {
      const res = await digestMut.mutateAsync()
      toast.success(`${res.count} low stock items ka digest WhatsApp par bhej diya.`)
    } catch (err: any) {
      // Server refusals are specific and honest (alerts off, nothing
      // low, no shop phone, not connected): show the message as-is.
      toast.error(err.message || 'Digest nahi bheja ja saka.')
    }
  }

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleMut.mutateAsync({ enabled })
      toast.success(enabled ? 'Low stock WhatsApp alerts chalu.' : 'Low stock WhatsApp alerts band.')
      void utils.settings.getShopSettings.invalidate()
    } catch (err: any) {
      toast.error(err.message || 'Setting save nahi ho payi.')
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

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-[#FF3B30]" aria-hidden="true" />
            Low Stock
          </h1>
          <p className="text-gray-500 dark:text-[#98989D] mt-1 text-[15px]">
            Ye items apne alert level par ya usse neeche hain. Samay par order kar do.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDigest()}
          disabled={digestMut.isPending || items.length === 0}
          className="tap inline-flex items-center gap-2 min-h-[52px] px-5 rounded-2xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-40 text-white font-bold transition-colors"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          WhatsApp Digest Bhejo
        </button>
      </div>

      <label className="flex items-center justify-between gap-3 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-2xl px-4 py-3 cursor-pointer">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          WhatsApp low-stock alerts
          <span className="block text-xs font-normal text-gray-500">
            Digest shop ke number par jata hai. Band karne par digest nahi bheja jayega, ye list hamesha chalegi.
          </span>
        </span>
        <input
          type="checkbox"
          checked={alertsOn}
          disabled={toggleMut.isPending || settingsQuery.isLoading}
          onChange={(e) => void handleToggle(e.target.checked)}
          className="w-5 h-5 accent-[#1B7A4A]"
        />
      </label>

      {listQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 dark:bg-[#2C2C2E] rounded-2xl h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-8 text-center">
          <p className="font-bold text-gray-900 dark:text-white">Sab stock theek hai</p>
          <p className="text-sm text-gray-500 mt-1">
            Koi item alert level par nahi hai. Alert level product ki detail me Catalog se set hota hai.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl overflow-hidden">
          <ul className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {items.map((p) => {
              const stock = Number(p.stock_qty) || 0
              const out = stock <= 0
              return (
                <li key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{p.name}</p>
                    <p className={`text-xs font-semibold ${out ? 'text-[#FF3B30]' : 'text-amber-600 dark:text-amber-400'}`}>
                      {out ? 'Stock khatm ho gaya' : `Sirf ${stock} ${p.unit || 'piece'} bacha`} ·
                      Alert level: {p.low_stock_alert}
                    </p>
                  </div>
                  <Link
                    href="/inventory"
                    className="tap inline-flex items-center min-h-[44px] px-4 rounded-full bg-gray-100 dark:bg-[#2C2C2E] font-bold text-sm shrink-0"
                  >
                    Stock Bharo
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
