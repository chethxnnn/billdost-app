import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { PageHeader } from '@/components/ui'
import RequestsBoard, { type RequestRow } from '@/components/RequestsBoard'

export const dynamic = 'force-dynamic'

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'applications')) redirect('/dashboard')

  const { status } = await searchParams
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('access_requests')
    .select(
      'id, shop_name, owner_name, whatsapp_number, category, city, approx_products, note, status, created_at, assignee_id, claimed_at, started_at, converted_shop_id'
    )
    .order('created_at', { ascending: false })
    .limit(300)

  const rows = (data ?? []) as RequestRow[]
  const shopIds = rows
    .map((r) => r.converted_shop_id)
    .filter((v): v is string => Boolean(v))
  if (shopIds.length > 0) {
    const { data: shops } = await supabase
      .from('shops')
      .select('id, status')
      .in('id', shopIds)
    const statusByShop = new Map(
      (shops ?? []).map((s) => [s.id as string, s.status as string])
    )
    for (const r of rows) {
      r.shop_status = r.converted_shop_id
        ? statusByShop.get(r.converted_shop_id) ?? null
        : null
    }
  }

  const { data: members } = await supabase
    .from('admin_users')
    .select('id, display_name')
    .eq('status', 'active')
    .order('display_name')

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Requests from the website, in pipeline order. Call first, decide second."
      />
      <RequestsBoard
        requests={rows}
        initialStatus={status}
        members={(members ?? []).map((m) => ({
          id: m.id as string,
          name: m.display_name as string,
        }))}
        currentAdminId={admin.id}
        canAssign={can(admin.role, 'assign')}
      />
    </div>
  )
}
