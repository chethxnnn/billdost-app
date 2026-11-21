import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { Card, PageHeader, Pill, StatCard, Tile } from '@/components/ui'
import { Wallet } from 'lucide-react'
import FinanceTable, { type FinanceShop } from '@/components/FinanceTable'
import { formatCount, formatDate, formatINR } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Finance lite (plan Section 6G, v1): who is on which plan, what is
 * due and overdue, and expected plan revenue by month. There is no
 * invoicing of shops in v1, so "collected" is not shown: expected
 * revenue is computed from plan amounts and due dates only, and it is
 * labelled as expected.
 */
export default async function FinancePage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'finance_view')) redirect('/dashboard')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('shops')
    .select('id, name, plan, plan_amount, plan_status, plan_next_due')
    .is('deleted_at', null)
    .order('plan_next_due', { ascending: true, nullsFirst: false })
    .limit(500)

  const shops: FinanceShop[] = (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    plan: s.plan as string,
    amount: Number(s.plan_amount ?? 0),
    status: s.plan_status as string,
    nextDue: (s.plan_next_due as string) ?? null,
  }))

  const today = new Date()
  const in30 = new Date(today.getTime() + 30 * 86400000)
  const dueSoon = shops.filter(
    (s) =>
      s.nextDue &&
      new Date(s.nextDue) <= in30 &&
      s.status !== 'cancelled' &&
      s.amount > 0
  )
  const overdue = shops.filter((s) => s.status === 'overdue')

  const byPlan = new Map<string, number>()
  for (const s of shops) byPlan.set(s.plan, (byPlan.get(s.plan) ?? 0) + 1)

  // Expected plan revenue, next 6 months, from due dates and amounts.
  const months: { label: string; total: number; count: number }[] = []
  for (let m = 0; m < 6; m++) {
    const start = new Date(today.getFullYear(), today.getMonth() + m, 1)
    const end = new Date(today.getFullYear(), today.getMonth() + m + 1, 1)
    const inMonth = shops.filter(
      (s) =>
        s.nextDue &&
        new Date(s.nextDue) >= start &&
        new Date(s.nextDue) < end &&
        s.status !== 'cancelled'
    )
    months.push({
      label: start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      total: inMonth.reduce((sum, s) => sum + s.amount, 0),
      count: inMonth.length,
    })
  }
  const monthMax = Math.max(1, ...months.map((m) => m.total))

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Plans, dues and expected revenue. Lite by design: no invoicing of shops in v1."
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Paying shops" value={formatCount(shops.filter((s) => s.amount > 0).length)} sub={`of ${formatCount(shops.length)} shops`} />
        <StatCard label="Free plan" value={formatCount(byPlan.get('free') ?? 0)} sub={`Standard ${byPlan.get('standard') ?? 0} · Pro ${byPlan.get('pro') ?? 0}`} />
        <StatCard label="Due in 30 days" value={formatINR(dueSoon.reduce((s, x) => s + x.amount, 0))} sub={`${dueSoon.length} shops`} attention={dueSoon.length > 0} />
        <StatCard label="Overdue" value={formatCount(overdue.length)} sub={overdue.length ? 'Needs a call, not a lockout' : 'Nothing overdue'} attention={overdue.length > 0} />
      </div>

      {dueSoon.length > 0 ? (
        <Card className="p-5 mt-4">
          <h2 className="text-[16px] font-bold mb-3">Due and overdue</h2>
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
            {dueSoon.map((s) => (
              <li key={s.id} className="py-3 flex items-center gap-3">
                <Tile tone={s.status === 'overdue' ? 'pink' : 'amber'}>
                  <Wallet className="w-5 h-5" />
                </Tile>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[14px] truncate">{s.name}</span>
                  <span className="block text-[12px] font-medium text-[#86868B]">
                    {s.nextDue ? `Due ${formatDate(s.nextDue)}` : 'No due date'}
                  </span>
                </span>
                <Pill tone={s.status === 'overdue' ? 'red' : 'amber'}>{s.status}</Pill>
                <span className="w-[110px] text-right text-[15px] font-extrabold tabular-nums">
                  {formatINR(s.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-5 mt-4">
        <h2 className="text-[16px] font-bold mb-1.5">Expected plan revenue</h2>
        <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mb-4">
          From plan amounts and due dates. Expected, not collected.
        </p>
        <div className="space-y-2.5">
          {months.map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <span className="w-24 text-[13px] font-semibold">{m.label}</span>
              <div className="flex-1 h-6 bg-black/[0.04] dark:bg-white/[0.06] rounded-lg overflow-hidden">
                <div
                  className="h-full bg-[#1B7A4A]/80 dark:bg-[#25D366]/70 rounded-lg transition-all duration-300"
                  style={{ width: `${Math.max(2, (m.total / monthMax) * 100)}%` }}
                />
              </div>
              <span className="w-32 text-right text-[13px] font-bold tabular-nums">
                {formatINR(m.total)} <span className="font-medium text-[#86868B]">({m.count})</span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4">
        <FinanceTable shops={shops} />
      </div>
    </div>
  )
}
