import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { PageHeader, btnPrimary } from '@/components/ui'
import ShopsTable, { type ShopRow } from '@/components/ShopsTable'

export const dynamic = 'force-dynamic'

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'shops_view')) redirect('/dashboard')

  const { status } = await searchParams
  const supabase = createAdminClient()

  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, category, status, plan, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300)
  const shopList = shops ?? []
  const shopIds = shopList.map((s) => s.id as string)

  const [{ data: owners }, { data: invoices }] = await Promise.all([
    supabase
      .from('staff_members')
      .select('shop_id, name, phone')
      .in('shop_id', shopIds)
      .eq('role', 'owner'),
    supabase
      .from('invoices')
      .select('shop_id, created_at')
      .in('shop_id', shopIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5000),
  ])

  const ownerByShop = new Map<string, { name: string; phone: string }>()
  for (const o of owners ?? []) {
    if (!ownerByShop.has(o.shop_id as string)) {
      ownerByShop.set(o.shop_id as string, {
        name: (o.name as string) ?? '',
        phone: (o.phone as string) ?? '',
      })
    }
  }
  const billsByShop = new Map<string, number>()
  const lastBillByShop = new Map<string, string>()
  for (const inv of invoices ?? []) {
    const sid = inv.shop_id as string
    billsByShop.set(sid, (billsByShop.get(sid) ?? 0) + 1)
    if (!lastBillByShop.has(sid)) lastBillByShop.set(sid, inv.created_at as string)
  }

  const rows: ShopRow[] = shopList.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    category: s.category as string,
    status: s.status as string,
    plan: s.plan as string,
    ownerName: ownerByShop.get(s.id as string)?.name ?? '',
    ownerPhone: ownerByShop.get(s.id as string)?.phone ?? '',
    bills: billsByShop.get(s.id as string) ?? 0,
    lastBillAt: lastBillByShop.get(s.id as string) ?? null,
    createdAt: s.created_at as string,
  }))

  return (
    <div>
      <PageHeader
        title="Shops"
        subtitle="Every client, one list. Search is the hero here."
        action={
          can(admin.role, 'shop_setup') ? (
            <Link href="/shops/new" className={btnPrimary}>
              Set up a shop
            </Link>
          ) : undefined
        }
      />
      <ShopsTable shops={rows} initialStatus={status} />
    </div>
  )
}
