'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { btnGhost, Card, Pill } from '@/components/ui'
import { formatDate, formatINR } from '@/lib/format'

export interface FinanceShop {
  id: string
  name: string
  plan: string
  amount: number
  status: string
  nextDue: string | null
}

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'neutral' | 'blue'> = {
  active: 'green',
  trial: 'blue',
  due: 'amber',
  overdue: 'red',
  cancelled: 'neutral',
}

/**
 * Finance lite table (plan Section 6G, v1): plans, amounts, due
 * dates. The CSV export is generated here from the loaded rows, and
 * the server records the export in the audit log first.
 */
export default function FinanceTable({ shops }: { shops: FinanceShop[] }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function exportCsv() {
    setBusy(true)
    setNote('')
    try {
      const res = await fetch('/api/finance/export', { method: 'POST' })
      if (!res.ok) throw new Error('audit failed')
      const header = 'Shop,Plan,Amount (Rs),Plan status,Next due date'
      const lines = shops.map((s) =>
        [
          `"${s.name.replace(/"/g, '""')}"`,
          s.plan,
          s.amount,
          s.status,
          s.nextDue ?? '',
        ].join(',')
      )
      const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `billdost-finance-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setNote('Sheet downloaded. The export is recorded in the audit log.')
    } catch {
      setNote('Export failed. Try again.')
    }
    setBusy(false)
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.07]">
        <h2 className="text-[16px] font-bold">Plans by shop</h2>
        <button disabled={busy} onClick={exportCsv} className={btnGhost}>
          <Download className="w-4 h-4" /> {busy ? 'Preparing...' : 'Export CSV for the CA'}
        </button>
      </div>
      {note ? <p className="px-5 pt-3 text-[13px] font-medium">{note}</p> : null}
      {shops.length === 0 ? (
        <p className="px-5 py-8 text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
          No shops yet, so no plans to show.
        </p>
      ) : (
        <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
          {shops.map((s) => (
            <li key={s.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
              <Link href={`/shops/${s.id}`} className="flex-1 min-w-[160px] font-bold text-[14px] hover:underline underline-offset-4">
                {s.name}
              </Link>
              <span className="text-[13px] font-semibold capitalize">{s.plan}</span>
              <span className="text-[14px] font-bold tabular-nums">{formatINR(s.amount)}</span>
              <Pill tone={STATUS_TONE[s.status] ?? 'neutral'}>{s.status}</Pill>
              <span className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] w-28 text-right">
                {s.nextDue ? `Due ${formatDate(s.nextDue)}` : 'No due date'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
