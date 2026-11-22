import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { PageHeader } from '@/components/ui'
import RequestsBoard, { type RequestRow } from '@/components/RequestsBoard'
import type { DirectShopRow } from '@/lib/pipeline-stages'

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

  // Shops created directly in the Setup Studio have no request row.
  // They belong on the same board, mapped from their shop status, so
  // no shop can exist in the system and be invisible here.
  const linkedShopIds = new Set(shopIds)
  const { data: allShops } = await supabase
    .from('shops')
    .select('id, name, category, status, state, created_at, support_owner_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300)
  const directList = (allShops ?? []).filter(
    (s) => !linkedShopIds.has(s.id as string)
  )
  const directIds = directList.map((s) => s.id as string)
  const directOwnerByShop = new Map<string, { name: string; phone: string }>()
  if (directIds.length > 0) {
    const { data: owners } = await supabase
      .from('staff_members')
      .select('shop_id, name, phone')
      .in('shop_id', directIds)
      .eq('role', 'owner')
    for (const o of owners ?? []) {
      if (!directOwnerByShop.has(o.shop_id as string)) {
        directOwnerByShop.set(o.shop_id as string, {
          name: (o.name as string) ?? '',
          phone: (o.phone as string) ?? '',
        })
      }
    }
  }
  const directShops: DirectShopRow[] = directList.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    category: s.category as string,
    status: s.status as string,
    created_at: s.created_at as string,
    owner_name: directOwnerByShop.get(s.id as string)?.name ?? '',
    owner_phone: directOwnerByShop.get(s.id as string)?.phone ?? '',
    state: (s.state as string) || null,
    support_owner_id: (s.support_owner_id as string) ?? null,
  }))

  const { data: members } = await supabase
    .from('admin_users')
    .select('id, display_name')
    .eq('status', 'active')
    .order('display_name')

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Requests from the website and shops set up directly, in pipeline order. Call first, decide second."
      />
      <RequestsBoard
        requests={rows}
        directShops={directShops}
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
