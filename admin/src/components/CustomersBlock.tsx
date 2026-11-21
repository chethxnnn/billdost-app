'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { formatMoneyExact, maskPhone } from '@/lib/format'

interface CustomerRow {
  id: string
  name: string
  phone: string | null
  total_billed: number | string
  total_paid: number | string
  opening_balance: number | string
}

function outstanding(c: CustomerRow): number {
  return Number(c.opening_balance ?? 0) + Number(c.total_billed ?? 0) - Number(c.total_paid ?? 0)
}

/**
 * Top buyers of the shop (plan Sections 6D and 12). Buyer phone
 * numbers are masked by default. Only the founder can unmask, the
 * server checks the role again, and the unmask is audit-logged.
 */
export default function CustomersBlock({
  shopId,
  customers,
  canUnmask,
}: {
  shopId: string
  customers: CustomerRow[]
  canUnmask: boolean
}) {
  const [unmasked, setUnmasked] = useState<CustomerRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const rows = unmasked ?? customers

  async function unmask() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/shops/${shopId}/customers`)
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Only the founder can view full numbers.')
      } else {
        setUnmasked(data.customers as CustomerRow[])
      }
    } catch {
      setError('Could not load. Try again.')
    }
    setBusy(false)
  }

  if (customers.length === 0) {
    return (
      <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
        No customers yet. They appear here as the shop bills.
      </p>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
        {rows.map((c) => (
          <li key={c.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14px] truncate">{c.name}</p>
              <p className="text-[12px] text-[#86868B] font-medium tabular-nums">
                {unmasked ? c.phone ?? 'No phone' : maskPhone(c.phone)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6]">
                Billed {formatMoneyExact(c.total_billed)}
              </p>
              <p className={`text-[13px] font-bold tabular-nums ${outstanding(c) > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {outstanding(c) > 0 ? `${formatMoneyExact(outstanding(c))} udhaar` : 'Settled'}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {canUnmask && !unmasked ? (
        <button
          disabled={busy}
          onClick={unmask}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366]"
        >
          <Eye className="w-4 h-4" /> {busy ? 'Loading...' : 'Show full numbers (founder only, logged)'}
        </button>
      ) : null}
      {error ? (
        <p className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  )
}
