import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { Avatar, Card } from '@/components/ui'
import AttentionQueue from '@/components/AttentionQueue'
import { formatCount, formatINR, timeAgo } from '@/lib/format'
import { describeAction } from '@/lib/audit-labels'
import {
  computeAttention,
  type AttentionIssue,
  type AttentionRequest,
  type AttentionShop,
  type AttentionToken,
} from '@/lib/attention'
import { presenceOf } from '@/lib/team-stats'

export const dynamic = 'force-dynamic'

/** Start of day in IST, offset by whole days. */
function istDayStart(daysAgo = 0): Date {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000)
  ist.setUTCHours(0, 0, 0, 0)
  ist.setUTCDate(ist.getUTCDate() - daysAgo)
  return new Date(ist.getTime() - 5.5 * 3600 * 1000)
}

/**
 * Today (Dock + Canvas): a sentence about the business, the numbers
 * that matter, and one ranked queue of what needs a human, computed
 * by the attention engine from real rows. Non-founder roles lead
 * with their own queue: what is assigned to them and in progress.
 * The team strip shows who is here and what they are doing now.
 */
export default async function DashboardPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'dashboard')) redirect('/finance')

  const supabase = createAdminClient()
  const now = new Date()
  const todayStart = istDayStart(0)
  const monthStart = istDayStart(new Date().getUTCDate() - 1)
  const wideStart = istDayStart(29)

  const [
    shopsRes,
    invoicesRes,
    requestsRes,
    tokensRes,
    errorsRes,
    waTodayRes,
    waMonthRes,
    auditRes,
    membersRes,
    callsRes,
  ] = await Promise.all([
    supabase
      .from('shops')
      .select('id, name, status, created_at, plan_status, plan_next_due, support_owner_id')
      .is('deleted_at', null)
      .limit(500),
    supabase
      .from('invoices')
      .select('shop_id, total, created_at')
      .eq('status', 'active')
      .gte('created_at', wideStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(8000),
    supabase
      .from('access_requests')
      .select('id, shop_name, status, created_at, assignee_id, started_at')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('activation_tokens')
      .select('shop_id, expires_at')
      .is('used_at', null)
      .is('replaced_at', null)
      .lte('expires_at', new Date(now.getTime() + 12 * 3600 * 1000).toISOString())
      .gte('expires_at', now.toISOString()),
    supabase
      .from('client_errors')
      .select('digest, error_name, issue_status, assignee_id, started_at, created_at')
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
      .select('id, admin_user_id, action, shop_id, request_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('admin_users')
      .select('id, display_name, role, last_active_at')
      .eq('status', 'active')
      .order('display_name'),
    supabase
      .from('call_logs')
      .select('request_id, created_at')
      .not('request_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const shops = shopsRes.data ?? []
  const shopName = new Map(shops.map((s) => [s.id as string, s.name as string]))
  const totalShops = shops.length
  const liveShops = shops.filter((s) => s.status === 'live').length

  const invoices = invoicesRes.data ?? []
  const todayInvoices = invoices.filter((i) => new Date(i.created_at as string) >= todayStart)
  const billsToday = todayInvoices.length
  const volumeToday = todayInvoices.reduce((sum, i) => sum + Number(i.total ?? 0), 0)

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

  const lastBillByShop = new Map<string, string>()
  for (const inv of invoices) {
    const sid = inv.shop_id as string
    if (!lastBillByShop.has(sid)) lastBillByShop.set(sid, inv.created_at as string)
  }

  const audit = auditRes.data ?? []
  const memberName = new Map(
    (membersRes.data ?? []).map((m) => [m.id as string, m.display_name as string])
  )

  // Latest touch per request: audit rows and call logs together.
  const lastActivityByRequest = new Map<string, string>()
  for (const e of audit) {
    if (e.request_id && !lastActivityByRequest.has(e.request_id as string)) {
      lastActivityByRequest.set(e.request_id as string, e.created_at as string)
    }
  }
  for (const c of callsRes.data ?? []) {
    const rid = c.request_id as string
    const t = c.created_at as string
    if (!lastActivityByRequest.has(rid) || lastActivityByRequest.get(rid)! < t) {
      lastActivityByRequest.set(rid, t)
    }
  }

  // Latest admin action per issue digest.
  const lastIssueAction = new Map<string, string>()
  for (const e of audit) {
    const digest = (e.details as { digest?: string })?.digest
    if (digest && (e.action as string).startsWith('issue_') && !lastIssueAction.has(digest)) {
      lastIssueAction.set(digest, e.created_at as string)
    }
  }

  const issueGroups = new Map<string, AttentionIssue & { startedAt: string | null }>()
  for (const row of errorsRes.data ?? []) {
    const digest = (row.digest as string) || 'unknown'
    if (!issueGroups.has(digest)) {
      issueGroups.set(digest, {
        digest,
        title: (row.error_name as string) || 'Error',
        status: row.issue_status as string,
        assignee_id: (row.assignee_id as string) ?? null,
        last_admin_action_at: lastIssueAction.get(digest) ?? null,
        startedAt: (row.started_at as string) ?? null,
      })
    }
  }

  const attentionInput = {
    now,
    requests: (requestsRes.data ?? []).map(
      (r): AttentionRequest => ({
        id: r.id as string,
        shop_name: r.shop_name as string,
        status: r.status as string,
        created_at: r.created_at as string,
        assignee_id: (r.assignee_id as string) ?? null,
        last_activity_at: lastActivityByRequest.get(r.id as string) ?? null,
      })
    ),
    tokens: (tokensRes.data ?? []).map(
      (t): AttentionToken => ({
        shop_id: t.shop_id as string,
        shop_name: shopName.get(t.shop_id as string) ?? 'A shop',
        expires_at: t.expires_at as string,
      })
    ),
    shops: shops.map(
      (s): AttentionShop => ({
        id: s.id as string,
        name: s.name as string,
        status: s.status as string,
        created_at: s.created_at as string,
        plan_status: (s.plan_status as string) ?? 'active',
        plan_next_due: (s.plan_next_due as string) ?? null,
        last_invoice_at: lastBillByShop.get(s.id as string) ?? null,
      })
    ),
    issues: [...issueGroups.values()],
  }
  const allItems = computeAttention(attentionInput)
  const canSeeFounderItems = can(admin.role, 'activation_approve')
  const items = allItems
    .filter((i) => canSeeFounderItems || !i.founderOnly)
    .slice(0, 8)

  // My Work: for non-founder roles, Today leads with their own queue.
  const isFounderLevel = admin.role === 'founder' || admin.role === 'co_founder'
  const myRequests = (requestsRes.data ?? []).filter(
    (r) =>
      r.assignee_id === admin.id &&
      !['live', 'rejected'].includes(r.status as string)
  )
  const myIssues = [...issueGroups.values()].filter((g) => g.assignee_id === admin.id)
  const myShops = shops.filter((s) => s.support_owner_id === admin.id)
  const hasMyWork = myRequests.length + myIssues.length + myShops.length > 0

  // Who is doing what, right now: the latest started item per member.
  const doingNow = new Map<string, string>()
  const startedRequests = (requestsRes.data ?? [])
    .filter((r) => r.started_at && r.assignee_id)
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
  for (const r of startedRequests) {
    const aid = r.assignee_id as string
    if (!doingNow.has(aid)) doingNow.set(aid, `Working on ${r.shop_name as string}`)
  }
  for (const g of issueGroups.values()) {
    if (g.startedAt && g.assignee_id && !doingNow.has(g.assignee_id)) {
      doingNow.set(g.assignee_id, `On the issue: ${g.title}`)
    }
  }

  const firstName = admin.displayName.split(' ')[0]
  const newRequests = (requestsRes.data ?? []).filter((r) => r.status === 'new').length
  const sentence =
    items.length > 0
      ? `${formatCount(liveShops)} of ${formatCount(totalShops)} shops are live, ${formatCount(billsToday)} bills came in today, and ${items.length} thing${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} your attention.`
      : `${formatCount(liveShops)} of ${formatCount(totalShops)} shops are live and ${formatCount(billsToday)} bills came in today. The queue is clear.`

  const heroNums: { label: string; value: string; sub: string }[] = [
    { label: 'Bills today', value: formatCount(billsToday), sub: `${formatINR(volumeToday)} billed` },
    { label: 'Live shops', value: formatCount(liveShops), sub: `of ${formatCount(totalShops)} total` },
    { label: 'New requests', value: formatCount(newRequests), sub: newRequests ? 'Waiting for a call' : 'All caught up' },
    { label: 'WhatsApp today', value: formatCount(waTodayRes.count ?? 0), sub: `${formatCount(waMonthRes.count ?? 0)} this month` },
  ]

  return (
    <div>
      <p className="text-[13px] font-bold uppercase tracking-widest text-[#86868B]">
        {now.toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>
      <h1 className="text-[30px] md:text-[36px] font-extrabold tracking-[-0.02em] leading-tight mt-1.5">
        Namaste, {firstName}.
      </h1>
      <p className="text-[16px] md:text-[17px] font-medium text-[#3A3A3C] dark:text-[#D1D1D6] leading-relaxed mt-1.5 max-w-2xl">
        {sentence}
      </p>

      {!isFounderLevel ? (
        <Card className="p-5 mt-6">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[16px] font-bold">My work</h2>
            <Link href="/team" className="text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366]">
              Team
            </Link>
          </div>
          {!hasMyWork ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed">
              Nothing is assigned to you right now. Claim anything from
              the queue below, or from the Pipeline.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {myRequests.map((r) => (
                <li key={r.id as string} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/applications/${r.id}`} className="font-semibold text-[14px] hover:underline underline-offset-4 block truncate">
                      {r.shop_name as string}
                    </Link>
                    <p className="text-[12px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
                      Request · {(r.status as string).replace(/_/g, ' ')}
                      {r.started_at ? ' · in progress' : ''}
                    </p>
                  </div>
                  <Link href={`/applications/${r.id}`} className="text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366] shrink-0">
                    Open
                  </Link>
                </li>
              ))}
              {myIssues.map((g) => (
                <li key={g.digest} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/issues?digest=${encodeURIComponent(g.digest)}`} className="font-semibold text-[14px] hover:underline underline-offset-4 block truncate">
                      {g.title}
                    </Link>
                    <p className="text-[12px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
                      Issue · {g.status}
                      {g.startedAt ? ' · in progress' : ''}
                    </p>
                  </div>
                  <Link href={`/issues?digest=${encodeURIComponent(g.digest)}`} className="text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366] shrink-0">
                    Open
                  </Link>
                </li>
              ))}
              {myShops.map((s) => (
                <li key={s.id as string} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/shops/${s.id}`} className="font-semibold text-[14px] hover:underline underline-offset-4 block truncate">
                      {s.name as string}
                    </Link>
                    <p className="text-[12px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
                      Shop you support · {(s.status as string).replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Link href={`/shops/${s.id}`} className="text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366] shrink-0">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card className="p-5 mt-6">
        {/* The queue header pins inside the card while its rows
            scroll beneath it, and stops at the card's bottom edge. */}
        <div className="sticky-card-head -mx-5 -mt-5 px-5 pt-5 pb-3 mb-1 rounded-t-[20px] flex items-baseline justify-between">
          <h2 className="text-[16px] font-bold">Needs attention</h2>
          <Link href="/applications" className="text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366]">
            Pipeline
          </Link>
        </div>
        <AttentionQueue
          items={items}
          currentAdminId={admin.id}
          canAssign={can(admin.role, 'assign')}
        />
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 mt-8 border-y border-black/[0.06] dark:border-white/[0.08]">
        {heroNums.map((n, i) => (
          <div
            key={n.label}
            className={`py-5 ${i > 0 ? 'pl-5 border-l border-black/[0.06] dark:border-white/[0.08]' : ''} ${i >= 2 ? 'max-xl:border-l-0 max-xl:pl-0' : ''}`}
          >
            <p className="text-[30px] md:text-[34px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
              {n.value}
            </p>
            <p className="text-[13px] font-bold mt-2">{n.label}</p>
            <p className="text-[12px] font-medium text-[#86868B]">{n.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-3 md:gap-4 mt-6">
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
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[16px] font-bold">Team right now</h2>
            <Link href="/team" className="text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366]">
              Open Team
            </Link>
          </div>
          {(membersRes.data ?? []).length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
              Just you, for now.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {(membersRes.data ?? []).map((m) => {
                const presence = presenceOf((m.last_active_at as string) ?? null, now)
                const doing = doingNow.get(m.id as string)
                return (
                  <li key={m.id as string} className="py-2.5 flex items-center gap-3">
                    <Avatar
                      name={m.display_name as string}
                      size={36}
                      presence={presence.state === 'active' ? 'active' : presence.state === 'away' ? 'away' : null}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] truncate">
                        {m.display_name as string}
                        {m.id === admin.id ? <span className="text-[#86868B] font-medium"> (you)</span> : null}
                      </p>
                      <p className="text-[12px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium truncate">
                        {doing ?? presence.label}
                      </p>
                    </div>
                    {doing ? (
                      <span className="text-[12px] font-medium text-[#86868B] shrink-0">{presence.label}</span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5 mt-3 md:mt-4">
        <h2 className="text-[16px] font-bold mb-3">Latest activity</h2>
        {audit.length === 0 ? (
          <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
            Nothing yet. Setups, approvals, calls and team actions will appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {audit.slice(0, 10).map((entry) => {
              const who = entry.admin_user_id
                ? memberName.get(entry.admin_user_id as string) ?? 'A team member'
                : 'The system'
              return (
                <li key={entry.id as string} className="flex items-start gap-3 text-[14px] font-medium leading-relaxed">
                  {entry.admin_user_id ? (
                    <Avatar name={who} size={28} />
                  ) : (
                    <span className="w-7 h-7 shrink-0 rounded-full bg-black/[0.05] dark:bg-white/[0.08]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold">{who}</span>{' '}
                    {describeAction(entry.action as string)}{' '}
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
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
