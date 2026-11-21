import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { PageHeader } from '@/components/ui'
import TeamManager, { type TeamMember } from '@/components/TeamManager'
import TeamBoard, { type MemberView, type TimelineEntry } from '@/components/TeamBoard'
import { computeTodayCounts, presenceOf } from '@/lib/team-stats'
import type { AdminRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

/** Start of today in IST. */
function istDayStart(): Date {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000)
  ist.setUTCHours(0, 0, 0, 0)
  return new Date(ist.getTime() - 5.5 * 3600 * 1000)
}

/**
 * The Team screen (Nov 22): the whole product team in one place.
 * Directory, presence, who is doing what right now, today's counts
 * from the audit log and call logs, assignment loads, and the full
 * activity timeline. Everything the team does inside the portal
 * writes the log itself, so this screen is assembled, never typed.
 * Founders and co-founders see everyone's counts; everyone else
 * sees the directory, the loads, and only their own counts.
 * Managing people (add, disable, re-role) stays team_manage.
 */
export default async function TeamPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'team_view')) redirect('/dashboard')

  const supabase = createAdminClient()
  const now = new Date()
  const todayStart = istDayStart()
  const canSeeAll = admin.role === 'founder' || admin.role === 'co_founder'

  const [
    membersRes,
    auditTodayRes,
    callsTodayRes,
    timelineRes,
    requestsRes,
    shopsRes,
    errorsRes,
  ] = await Promise.all([
    supabase
      .from('admin_users')
      .select('id, display_name, email, role, status, last_active_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('admin_audit_log')
      .select('admin_user_id, action')
      .gte('created_at', todayStart.toISOString())
      .limit(1000),
    supabase
      .from('call_logs')
      .select('admin_id')
      .gte('created_at', todayStart.toISOString())
      .limit(1000),
    supabase
      .from('admin_audit_log')
      .select('id, admin_user_id, action, shop_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('access_requests')
      .select('id, shop_name, status, assignee_id, started_at')
      .not('status', 'in', '("live","rejected")')
      .limit(500),
    supabase
      .from('shops')
      .select('id, name, support_owner_id')
      .is('deleted_at', null)
      .limit(500),
    supabase
      .from('client_errors')
      .select('digest, error_name, assignee_id, started_at')
      .in('issue_status', ['new', 'investigating'])
      .limit(1000),
  ])

  const members = membersRes.data ?? []
  const memberName = new Map(
    members.map((m) => [m.id as string, m.display_name as string])
  )
  const shopName = new Map(
    (shopsRes.data ?? []).map((s) => [s.id as string, s.name as string])
  )

  // Doing now: latest started item per member.
  const doingNow = new Map<string, string>()
  const startedRequests = (requestsRes.data ?? [])
    .filter((r) => r.started_at && r.assignee_id)
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
  for (const r of startedRequests) {
    const aid = r.assignee_id as string
    if (!doingNow.has(aid)) doingNow.set(aid, `Working on ${r.shop_name as string}`)
  }
  const issueGroups = new Map<string, { title: string; assigneeId: string | null; startedAt: string | null }>()
  for (const row of errorsRes.data ?? []) {
    const digest = (row.digest as string) || 'unknown'
    if (!issueGroups.has(digest)) {
      issueGroups.set(digest, {
        title: (row.error_name as string) || 'Error',
        assigneeId: (row.assignee_id as string) ?? null,
        startedAt: (row.started_at as string) ?? null,
      })
    }
  }
  for (const g of issueGroups.values()) {
    if (g.startedAt && g.assigneeId && !doingNow.has(g.assigneeId)) {
      doingNow.set(g.assigneeId, `On the issue: ${g.title}`)
    }
  }

  const auditToday = (auditTodayRes.data ?? []) as { admin_user_id: string | null; action: string }[]
  const callsToday = (callsTodayRes.data ?? []) as { admin_id: string }[]

  const views: MemberView[] = members.map((m) => {
    const id = m.id as string
    const showCounts = canSeeAll || id === admin.id
    return {
      id,
      name: m.display_name as string,
      email: m.email as string,
      role: m.role as AdminRole,
      status: m.status as string,
      presence: presenceOf((m.last_active_at as string) ?? null, now),
      doingNow: doingNow.get(id) ?? null,
      counts: showCounts ? computeTodayCounts(auditToday, callsToday, id) : null,
      assignments: {
        requests: (requestsRes.data ?? []).filter((r) => r.assignee_id === id).length,
        shops: (shopsRes.data ?? []).filter((s) => s.support_owner_id === id).length,
        issues: [...issueGroups.values()].filter((g) => g.assigneeId === id).length,
      },
    }
  })

  const timeline: TimelineEntry[] = (timelineRes.data ?? []).map((e) => ({
    id: e.id as string,
    adminId: (e.admin_user_id as string) ?? null,
    who: e.admin_user_id
      ? memberName.get(e.admin_user_id as string) ?? 'A team member'
      : 'The system',
    action: e.action as string,
    shopId: (e.shop_id as string) ?? null,
    shopName: e.shop_id
      ? shopName.get(e.shop_id as string) ?? 'a shop'
      : ((e.details as { shop_name?: string })?.shop_name ?? ''),
    reason:
      ((e.details as { reason?: string; note?: string })?.reason ??
        (e.details as { note?: string })?.note) ||
      null,
    created_at: e.created_at as string,
  }))

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Who is here, who is doing what, and what got done today. The log writes itself."
      />
      <TeamBoard members={views} timeline={timeline} currentAdminId={admin.id} />

      {can(admin.role, 'team_manage') ? (
        <div className="mt-8">
          <h2 className="text-[18px] font-extrabold tracking-[-0.02em] mb-3">Manage access</h2>
          <TeamManager
            members={(members ?? []) as unknown as TeamMember[]}
            currentAdminId={admin.id}
            currentRole={admin.role}
          />
        </div>
      ) : null}
    </div>
  )
}
