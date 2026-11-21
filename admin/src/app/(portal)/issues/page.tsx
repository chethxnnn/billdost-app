import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { EmptyState, PageHeader } from '@/components/ui'
import IssueGroupCard, { type IssueGroup } from '@/components/IssueGroupCard'

export const dynamic = 'force-dynamic'

const FILTERS = ['open', 'new', 'investigating', 'fixed', 'informed', 'all'] as const

/** Display sections, in workflow order. Each section header pins
 *  under the shell header while its issues scroll, then the next
 *  section pushes it away. */
const STATUS_SECTIONS = [
  { key: 'new', label: 'New' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'fixed', label: 'Fixed' },
  { key: 'informed', label: 'Informed' },
] as const

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; digest?: string }>
}) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'issues') && !can(admin.role, 'issues_status')) redirect('/dashboard')

  const params = await searchParams
  const filter = (FILTERS as readonly string[]).includes(params.status ?? '')
    ? (params.status as string)
    : 'open'
  const highlight = params.digest ?? null

  const supabase = createAdminClient()
  const { data: rows } = await supabase
    .from('client_errors')
    .select(
      'digest, error_name, message, route, shop_id, issue_status, internal_note, created_at, stack, app_version, assignee_id, started_at'
    )
    .order('created_at', { ascending: false })
    .limit(1000)

  const { data: shops } = await supabase.from('shops').select('id, name')
  const shopName = new Map((shops ?? []).map((s) => [s.id as string, s.name as string]))

  const { data: members } = await supabase
    .from('admin_users')
    .select('id, display_name')
    .eq('status', 'active')
    .order('display_name')
  const memberOptions = (members ?? []).map((m) => ({
    id: m.id as string,
    name: m.display_name as string,
  }))

  const groups = new Map<string, IssueGroup & { shopIds: Set<string> }>()
  for (const row of rows ?? []) {
    const digest = (row.digest as string) || 'unknown'
    let g = groups.get(digest)
    if (!g) {
      g = {
        digest,
        title: (row.error_name as string) || 'Error',
        message: (row.message as string) || '',
        route: (row.route as string) ?? null,
        count: 0,
        shopsAffected: 0,
        shopNames: [],
        firstSeen: row.created_at as string,
        lastSeen: row.created_at as string,
        status: row.issue_status as string,
        note: (row.internal_note as string) ?? null,
        assigneeId: (row.assignee_id as string) ?? null,
        startedAt: (row.started_at as string) ?? null,
        sample: {
          message: (row.message as string) ?? null,
          stack: (row.stack as string) ?? null,
          appVersion: (row.app_version as string) ?? null,
        },
        shopIds: new Set<string>(),
      }
      groups.set(digest, g)
    }
    g.count += 1
    if (row.shop_id) g.shopIds.add(row.shop_id as string)
    if ((row.created_at as string) < g.firstSeen) g.firstSeen = row.created_at as string
  }
  for (const g of groups.values()) {
    g.shopsAffected = g.shopIds.size
    g.shopNames = [...g.shopIds].map((id) => shopName.get(id) ?? 'A shop')
  }

  const all = [...groups.values()].sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  )
  const visible = all.filter((g) => {
    if (highlight && g.digest === highlight) return true
    if (filter === 'all') return true
    if (filter === 'open') return g.status === 'new' || g.status === 'investigating'
    return g.status === filter
  })

  return (
    <div>
      <PageHeader
        title="Issue Centre"
        subtitle="Every error the shop app reports, grouped by bug. No raw error ever reaches a shopkeeper."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <a
            key={f}
            href={`/issues?status=${f}`}
            className={`px-3.5 py-2 rounded-full text-[13px] font-bold transition-colors duration-200 ${
              filter === f
                ? 'bg-[#1D1D1F] text-white dark:bg-white dark:text-black'
                : 'bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
            }`}
          >
            {f === 'open' ? 'Open' : f[0].toUpperCase() + f.slice(1)}
          </a>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? 'No issues reported' : 'Nothing in this view'}
          body={
            all.length === 0
              ? 'When a shop hits an error, it lands here grouped and readable, with the shop and time attached.'
              : 'Try another status filter.'
          }
        />
      ) : (
        <div className="space-y-6">
          {STATUS_SECTIONS.map((sec) => {
            const rows = visible.filter((g) => g.status === sec.key)
            if (rows.length === 0) return null
            return (
              <section key={sec.key}>
                <p className="sticky-group-head text-[13px] font-extrabold tracking-[-0.01em] mb-2 px-2 py-1.5 -mx-1 rounded-[8px]">
                  {sec.label}{' '}
                  <span className="text-[#86868B] tabular-nums">{rows.length}</span>
                </p>
                <div className="space-y-3">
                  {rows.map((g) => (
                    <IssueGroupCard
                      key={g.digest}
                      group={g}
                      canEdit={can(admin.role, 'issues_status')}
                      highlighted={highlight === g.digest}
                      members={memberOptions}
                      currentAdminId={admin.id}
                      canAssign={can(admin.role, 'assign')}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
