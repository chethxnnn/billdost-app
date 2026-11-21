'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, inputCls, labelCls } from '@/components/ui'

/**
 * Finance lite plan editor (plan Section 6G): plan, amount, status
 * and next due date. Nothing else about the shop can be changed from
 * here, by design.
 */
export default function PlanForm({
  shopId,
  plan,
  amount,
  status,
  nextDue,
}: {
  shopId: string
  plan: string
  amount: number
  status: string
  nextDue: string | null
}) {
  const router = useRouter()
  const [p, setP] = useState(plan)
  const [a, setA] = useState(String(amount))
  const [s, setS] = useState(status)
  const [d, setD] = useState(nextDue ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/shops/${shopId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: p,
          plan_amount: Number(a) || 0,
          plan_status: s,
          plan_next_due: d || null,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Could not save the plan.')
        setBusy(false)
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Could not save the plan. Try again.')
    }
    setBusy(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Plan</label>
          <select className={inputCls} value={p} onChange={(e) => setP(e.target.value)}>
            <option value="free">Free</option>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Amount (Rs)</label>
          <input className={inputCls} value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <label className={labelCls}>Plan status</label>
          <select className={inputCls} value={s} onChange={(e) => setS(e.target.value)}>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="due">Due</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Next due date</label>
          <input type="date" className={inputCls} value={d} onChange={(e) => setD(e.target.value)} />
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-[13px] font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {saved ? (
        <p className="mt-3 text-[13px] font-medium text-[#14663C] dark:text-[#25D366]">Plan saved.</p>
      ) : null}
      <button disabled={busy} onClick={save} className={btnPrimary + ' mt-4'}>
        {busy ? 'Saving...' : 'Save plan'}
      </button>
    </div>
  )
}
