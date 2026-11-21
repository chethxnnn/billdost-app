import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { Card, PageHeader, StatCard } from '@/components/ui'
import { formatCount, formatDate, formatINR, timeAgo } from '@/lib/format'
import { describeAction } from '@/lib/audit-labels'

export const dynamic = 'force-dynamic'

/** Start of day in IST, offset by whole days. */
function istDayStart(daysAgo = 0): Date {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000)
  ist.setUTCHours(0, 0, 0, 0)
  ist.setUTCDate(ist.getUTCDate() - daysAgo)
  return new Date(ist.getTime() - 5.5 * 3600 * 1000)
}

export default async function DashboardPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'dashboard')) redirect('/finance')

  const supabase = createAdminClient()
  const todayStart = istDayStart(0)
  const monthStart = istDayStart(new Date().getUTCDate() - 1)
  const trendStart = istDayStart(13)
  const quietCutoff = istDayStart(7)

  const [
    shopsRes,
    invoicesRes,
    newRequestsRes,
    errorsRes,
    waTodayRes,
    waMonthRes,
    auditRes,
    recentRequestsRes,
  ] = await Promise.all([
    supabase.from('shops').select('id, name, status, activated_at').is('deleted_at', null),
    supabase
      .from('invoices')
      .select('shop_id, total, created_at')
      .eq('status', 'active')
      .gte('created_at', trendStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('client_errors')
      .select('digest, issue_status')
      .in('issue_status', ['new', 'investigating'])
      .limit(1000),
    supabase
      .from('whatsapp_sends')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'delivered', 'read'])
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('whatsapp_sends')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'delivered', 'read'])
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('admin_audit_log')
      .select('id, action, shop_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('access_requests')
      .select('id, shop_name, owner_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const shops = shopsRes.data ?? []
  const totalShops = shops.length
  const liveShops = shops.filter((s) => s.status === 'live').length
  const pendingShops = shops.filter((s) => s.status === 'pending_activation').length

  const invoices = invoicesRes.data ?? []
  const todayInvoices = invoices.filter((i) => new Date(i.created_at as string) >= todayStart)
  const billsToday = todayInvoices.length
  const volumeToday = todayInvoices.reduce((sum, i) => sum + Number(i.total ?? 0), 0)
  const monthInvoices = invoices.filter((i) => new Date(i.created_at as string) >= monthStart)
  const volumeMonth = monthInvoices.reduce((sum, i) => sum + Number(i.total ?? 0), 0)

  // 14-day trend, oldest first.
  const trend: { label: string; count: number; total: number }[] = []
  for (let d = 13; d >= 0; d--) {
    const start = istDayStart(d)
    const end = istDayStart(d - 1)
    const day = invoices.filter((i) => {
      const t = new Date(i.created_at as string)
      return t >= start && t < end
    })
    trend.push({
      label: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      count: day.length,
      total: day.reduce((sum, i) => sum + Number(i.total ?? 0), 0),
    })
  }
  const trendMax = Math.max(1, ...trend.map((t) => t.count))

  const openIssueGroups = new Set((errorsRes.data ?? []).map((e) => e.digest)).size
  const newRequests = newRequestsRes.count ?? 0

  // Quiet shops: live, and no bill in the last 7 days.
  const lastBillByShop = new Map<string, string>()
  for (const inv of invoices) {
    const sid = inv.shop_id as string
    if (!lastBillByShop.has(sid)) lastBillByShop.set(sid, inv.created_at as string)
  }
  const quietShops = shops
    .filter((s) => s.status === 'live')
    .map((s) => ({ shop: s, lastBill: lastBillByShop.get(s.id as string) ?? null }))
    .filter((q) => !q.lastBill || new Date(q.lastBill) < quietCutoff)
    .slice(0, 6)

  const shopName = new Map(shops.map((s) => [s.id as string, s.name as string]))
  const firstName = admin.displayName.split(' ')[0]

  return (
    <div>
      <PageHeader
        title={`Namaste, ${firstName}`}
        subtitle={new Date().toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        action={
          newRequests > 0 && can(admin.role, 'applications') ? (
            <Link
              href="/applications?status=new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] text-white font-semibold rounded-full text-[14px] transition-all duration-200 shadow-sm shadow-[#1B7A4A]/20"
            >
              Review applications ({newRequests})
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total shops" value={formatCount(totalShops)} sub={`${liveShops} live${pendingShops ? `, ${pendingShops} pending activation` : ''}`} href="/shops" />
        <StatCard label="Live shops" value={formatCount(liveShops)} href="/shops?status=live" />
        <StatCard label="Bills today" value={formatCount(billsToday)} sub={`${formatINR(volumeToday)} billed today`} href="/shops" />
        <StatCard label="Billing volume" value={formatINR(volumeMonth)} sub="This month, all shops" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mt-3 md:mt-4">
        <StatCard label="Pending applications" value={formatCount(newRequests)} sub={newRequests ? 'Waiting for your call' : 'All caught up'} href="/applications?status=new" attention={newRequests > 0} />
        <StatCard label="Open issues" value={formatCount(openIssueGroups)} sub={openIssueGroups ? 'From the shop app error log' : 'Nothing open'} href="/issues" attention={openIssueGroups > 0} />
        <StatCard label="WhatsApp today" value={formatCount(waTodayRes.count ?? 0)} sub="Messages sent" />
        <StatCard label="WhatsApp this month" value={formatCount(waMonthRes.count ?? 0)} sub="Messages sent" />
      </div>

      <div className="grid lg:grid-cols-5 gap-3 md:gap-4 mt-3 md:mt-4">
        <Card className="p-5 lg:col-span-3">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[16px] font-bold">Bills, last 14 days</h2>
            <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6]">
              {formatCount(trend.reduce((s, t) => s + t.count, 0))} bills · {formatINR(trend.reduce((s, t) => s + t.total, 0))}
            </p>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {trend.map((t) => (
              <div key={t.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className="w-full rounded-t-md bg-[#1B7A4A]/80 dark:bg-[#25D366]/70 transition-all duration-300"
                  style={{ height: `${Math.max(4, (t.count / trendMax) * 100)}%` }}
                  title={`${t.label}: ${t.count} bills, ${formatINR(t.total)}`}
                />
                <span className="text-[10px] font-medium text-[#86868B] truncate w-full text-center">
                  {t.label.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-[16px] font-bold mb-3">Quiet shops</h2>
          {quietShops.length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed">
              Every live shop has billed in the last 7 days. Nothing to chase today.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {quietShops.map(({ shop, lastBill }) => (
                <li key={shop.id as string} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/shops/${shop.id}`} className="font-semibold text-[14px] hover:underline underline-offset-4 block truncate">
                      {shop.name as string}
                    </Link>
                    <p className="text-[12px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
                      {lastBill ? `Last bill ${timeAgo(lastBill)}` : 'No bills yet'}
                    </p>
                  </div>
                  <Link href={`/shops/${shop.id}`} className="text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366]">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-3">Recent activity</h2>
          {(auditRes.data ?? []).length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
              Nothing yet. Setups, activations and team actions will appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {(auditRes.data ?? []).map((entry) => (
                <li key={entry.id as string} className="text-[14px] font-medium leading-relaxed">
                  <span className="text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold">
                    {describeAction(entry.action as string)}
                  </span>{' '}
                  {entry.shop_id ? (
                    <Link href={`/shops/${entry.shop_id}`} className="text-[#1B7A4A] dark:text-[#25D366] font-semibold hover:underline underline-offset-4">
                      {shopName.get(entry.shop_id as string) ?? 'a shop'}
                    </Link>
                  ) : (
                    <span className="text-[#5A5A5E] dark:text-[#A1A1A6]">
                      {((entry.details as { shop_name?: string })?.shop_name) ?? ''}
                    </span>
                  )}
                  <span className="block text-[12px] text-[#86868B]">
                    {timeAgo(entry.created_at as string)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[16px] font-bold">Latest requests</h2>
            <Link href="/applications" className="text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366]">
              View all
            </Link>
          </div>
          {(recentRequestsRes.data ?? []).length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed">
              No requests yet. Share the BillDost link to get your next shop.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {(recentRequestsRes.data ?? []).map((r) => (
                <li key={r.id as string} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/applications/${r.id}`} className="font-semibold text-[14px] hover:underline underline-offset-4 block truncate">
                      {r.shop_name as string}
                    </Link>
                    <p className="text-[12px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
                      {r.owner_name as string} · {formatDate(r.created_at as string)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
