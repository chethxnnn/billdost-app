import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import { describeAction } from '@/lib/audit-labels'

export const dynamic = 'force-dynamic'

/**
 * The audit log view (plan Sections 6J and 12): who did what, to
 * which shop, when, in plain sentences. Filterable by admin and by
 * shop. The log itself is append-only; this screen only reads.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string; shop?: string }>
}) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'audit_view')) redirect('/dashboard')

  const params = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('admin_audit_log')
    .select('id, admin_user_id, action, shop_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (params.admin) query = query.eq('admin_user_id', params.admin)
  if (params.shop) query = query.eq('shop_id', params.shop)
  const { data: entries } = await query

  const [{ data: admins }, { data: shops }] = await Promise.all([
    supabase.from('admin_users').select('id, display_name'),
    supabase.from('shops').select('id, name').is('deleted_at', null).limit(300),
  ])
  const adminName = new Map((admins ?? []).map((a) => [a.id as string, a.display_name as string]))
  const shopName = new Map((shops ?? []).map((s) => [s.id as string, s.name as string]))

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every admin action, in plain sentences. Nothing here can be edited or deleted."
      />

      <form method="get" className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          name="admin"
          defaultValue={params.admin ?? ''}
          className="px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-[14px] font-semibold outline-none"
        >
          <option value="">All team members</option>
          {(admins ?? []).map((a) => (
            <option key={a.id as string} value={a.id as string}>
              {a.display_name as string}
            </option>
          ))}
        </select>
        <select
          name="shop"
          defaultValue={params.shop ?? ''}
          className="px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-[14px] font-semibold outline-none"
        >
          <option value="">All shops</option>
          {(shops ?? []).map((s) => (
            <option key={s.id as string} value={s.id as string}>
              {s.name as string}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-5 py-3 bg-[#1D1D1F] dark:bg-white text-white dark:text-black rounded-full text-[14px] font-bold active:scale-[0.98] transition-transform"
        >
          Filter
        </button>
        {params.admin || params.shop ? (
          <Link href="/audit" className="px-5 py-3 text-[14px] font-bold self-center">
            Clear
          </Link>
        ) : null}
      </form>

      {(entries ?? []).length === 0 ? (
        <EmptyState
          title="No entries match"
          body="Admin actions will appear here as the team works. Try clearing the filters."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
            {(entries ?? []).map((e) => {
              const who = e.admin_user_id
                ? adminName.get(e.admin_user_id as string) ?? 'A team member'
                : 'The system'
              const shopLabel = e.shop_id
                ? shopName.get(e.shop_id as string) ?? 'a shop'
                : ((e.details as { shop_name?: string })?.shop_name ?? '')
              return (
                <li key={e.id as string} className="px-5 py-3.5 text-[14px] font-medium leading-relaxed">
                  <span className="font-bold">{who}</span>{' '}
                  {describeAction(e.action as string)}{' '}
                  {shopLabel ? (
                    e.shop_id ? (
                      <Link href={`/shops/${e.shop_id}`} className="font-semibold text-[#1B7A4A] dark:text-[#25D366] hover:underline underline-offset-4">
                        {shopLabel}
                      </Link>
                    ) : (
                      <span className="font-semibold">{shopLabel}</span>
                    )
                  ) : null}
                  {(e.details as { reason?: string })?.reason ? (
                    <span className="text-[#5A5A5E] dark:text-[#A1A1A6]">
                      {' '}· Reason: {(e.details as { reason?: string }).reason}
                    </span>
                  ) : null}
                  <span className="block text-[12px] text-[#86868B] mt-0.5">
                    {formatDateTime(e.created_at as string)}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
