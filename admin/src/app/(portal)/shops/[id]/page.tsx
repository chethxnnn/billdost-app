import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import {
  Card,
  PageHeader,
  Pill,
  ShopStatusPill,
  StatCard,
} from '@/components/ui'
import ActivationPanel from '@/components/ActivationPanel'
import ShopActions from '@/components/ShopActions'
import NotesPanel, { type SupportNote } from '@/components/NotesPanel'
import PlanForm from '@/components/PlanForm'
import CustomersBlock from '@/components/CustomersBlock'
import { formatCount, formatDate, formatDateTime, formatINR, timeAgo } from '@/lib/format'
import { describeAction } from '@/lib/audit-labels'

export const dynamic = 'force-dynamic'

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'shops_view')) redirect('/dashboard')

  const { id } = await params
  const supabase = createAdminClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (!shop) notFound()

  const since30 = new Date(new Date().getTime() - 30 * 86400000).toISOString()
  const [
    invoicesRes,
    customersCountRes,
    customersRes,
    productsCountRes,
    productsRes,
    staffRes,
    waConnRes,
    activityRes,
    errorsRes,
    notesRes,
    auditRes,
    adminsRes,
    requestRes,
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('total, created_at')
      .eq('shop_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', id)
      .is('deleted_at', null),
    supabase
      .from('customers')
      .select('id, name, phone, total_billed, total_paid, opening_balance')
      .eq('shop_id', id)
      .is('deleted_at', null)
      .order('total_billed', { ascending: false })
      .limit(10),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', id)
      .is('deleted_at', null),
    supabase
      .from('products')
      .select('id, name, price, stock_qty')
      .eq('shop_id', id)
      .is('deleted_at', null)
      .order('stock_qty', { ascending: true })
      .limit(8),
    supabase
      .from('staff_members')
      .select('id, name, phone, email, role, status')
      .eq('shop_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('whatsapp_connections')
      .select('status, display_phone_number')
      .eq('shop_id', id)
      .single(),
    supabase
      .from('activity_log')
      .select('type, summary, created_at')
      .eq('shop_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('client_errors')
      .select('digest, error_name, created_at, issue_status')
      .eq('shop_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('shop_support_notes')
      .select('id, note, created_at, admin_user_id')
      .eq('shop_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('admin_audit_log')
      .select('action, details, created_at, admin_user_id')
      .eq('shop_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('admin_users').select('id, display_name'),
    supabase
      .from('access_requests')
      .select('id')
      .eq('converted_shop_id', id)
      .limit(1)
      .single(),
  ])

  const invoices = invoicesRes.data ?? []
  const billsTotal = invoices.length
  const bills30 = invoices.filter((i) => (i.created_at as string) >= since30)
  const volume30 = bills30.reduce((s, i) => s + Number(i.total ?? 0), 0)
  const lastBillAt = invoices[0]?.created_at as string | undefined

  const customersAll = customersRes.data ?? []
  // Udhaar needs every customer's balance, not just the top 10: one
  // extra aggregate read keeps the number honest.
  const { data: allCustomers } = await supabase
    .from('customers')
    .select('total_billed, total_paid, opening_balance')
    .eq('shop_id', id)
    .is('deleted_at', null)
    .limit(5000)
  const udhaar = (allCustomers ?? []).reduce((sum, c) => {
    const due =
      Number(c.opening_balance ?? 0) + Number(c.total_billed ?? 0) - Number(c.total_paid ?? 0)
    return due > 0 ? sum + due : sum
  }, 0)

  const staff = staffRes.data ?? []
  const owner = staff.find((s) => s.role === 'owner')
  const adminName = new Map((adminsRes.data ?? []).map((a) => [a.id as string, a.display_name as string]))
  const notes: SupportNote[] = (notesRes.data ?? []).map((n) => ({
    id: n.id as string,
    note: n.note as string,
    created_at: n.created_at as string,
    author: n.admin_user_id ? adminName.get(n.admin_user_id as string) ?? 'Team' : 'Team',
  }))

  const errorGroups = new Map<string, { title: string; count: number; status: string }>()
  for (const e of errorsRes.data ?? []) {
    const g = errorGroups.get(e.digest as string)
    if (g) g.count += 1
    else
      errorGroups.set(e.digest as string, {
        title: (e.error_name as string) || 'Error',
        count: 1,
        status: e.issue_status as string,
      })
  }

  const wa = waConnRes.data
  const subtitle = [
    shop.category as string,
    (shop.address as string) || (shop.state as string) || '',
    `Live since ${shop.activated_at ? formatDate(shop.activated_at as string) : formatDate(shop.created_at as string)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div>
      <PageHeader
        title={shop.name as string}
        subtitle={subtitle}
        action={<ShopStatusPill status={shop.status as string} />}
      />

      {shop.status === 'suspended' ? (
        <Card className="p-5 mb-4 border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/[0.07]">
          <p className="text-[15px] font-bold text-red-700 dark:text-red-300">This shop is suspended</p>
          <p className="text-[14px] font-medium text-red-700/80 dark:text-red-300/80 mt-1">
            Reason: {(shop.suspended_reason as string) || 'Not recorded'} · Since{' '}
            {shop.suspended_at ? formatDateTime(shop.suspended_at as string) : 'unknown'}. Data is untouched.
          </p>
        </Card>
      ) : null}

      {shop.status === 'pending_activation' ? (
        <Card className="p-5 md:p-6 mb-4">
          <h2 className="text-[16px] font-bold mb-1.5">Activation pending</h2>
          <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mb-4">
            Owner: {owner?.name ?? 'Not recorded'} · {owner?.phone ?? ''}. The shop goes live
            the moment the owner sets a password through the link.
          </p>
          {can(admin.role, 'activation_actions') ? (
            <ActivationPanel shopId={id} compact />
          ) : (
            <p className="text-[14px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6]">
              Your role cannot send activation links.
            </p>
          )}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Bills (30 days)" value={formatCount(bills30.length)} sub={`${formatCount(billsTotal)} all time`} />
        <StatCard label="Volume (30 days)" value={formatINR(volume30)} />
        <StatCard label="Udhaar outstanding" value={formatINR(udhaar)} sub={`Across ${formatCount(customersCountRes.count ?? 0)} customers`} attention={udhaar > 0} />
        <StatCard label="Last bill" value={lastBillAt ? timeAgo(lastBillAt) : 'None yet'} sub={lastBillAt ? formatDateTime(lastBillAt) : 'No bills so far'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-3">Shop facts</h2>
          <dl className="space-y-2.5 text-[14px]">
            {[
              ['Owner', `${owner?.name ?? 'Not recorded'}${owner?.phone ? ` · ${owner.phone}` : ''}`],
              ['Login ID', (shop.email as string) || 'Not set'],
              ['Category', shop.category as string],
              ['State', `${(shop.state as string) || ''} ${(shop.state_code as string) ?? ''}`.trim() || 'Not set'],
              ['GSTIN', (shop.gstin as string) || 'Not registered'],
              ['Products', `${formatCount(productsCountRes.count ?? 0)} in catalogue`],
              [
                'WhatsApp (shop number)',
                wa
                  ? `${wa.status === 'connected' ? 'Connected' : 'Not connected'}${wa.display_phone_number ? ` · ${wa.display_phone_number}` : ''}`
                  : 'Not connected',
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <dt className="w-40 shrink-0 font-semibold text-[#5A5A5E] dark:text-[#A1A1A6]">{label}</dt>
                <dd className="font-semibold break-words min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
          {requestRes.data ? (
            <Link href={`/applications/${requestRes.data.id}`} className="inline-block mt-4 text-[13px] font-bold text-[#1B7A4A] dark:text-[#25D366] hover:underline underline-offset-4">
              View the original request
            </Link>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-3">Staff</h2>
          {staff.length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">No staff rows yet.</p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {staff.map((s) => (
                <li key={s.id as string} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate">{s.name as string}</p>
                    <p className="text-[12px] text-[#86868B] font-medium">
                      {(s.phone as string) || (s.email as string) || ''}
                    </p>
                  </div>
                  <Pill tone={s.role === 'owner' ? 'green' : 'neutral'}>{s.role as string}</Pill>
                  <Pill tone={s.status === 'active' ? 'green' : 'amber'}>{s.status as string}</Pill>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-[#86868B] font-medium mt-3 leading-relaxed">
            Staff are managed by the owner inside the shop app. This list is read-only.
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-3">Top customers</h2>
          <CustomersBlock
            shopId={id}
            customers={customersAll as never[]}
            canUnmask={can(admin.role, 'unmask')}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-3">Lowest stock</h2>
          {(productsRes.data ?? []).length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">No products yet.</p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {(productsRes.data ?? []).map((p) => (
                <li key={p.id as string} className="py-2.5 flex items-center gap-3">
                  <p className="flex-1 font-semibold text-[14px] truncate">{p.name as string}</p>
                  <span className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] tabular-nums">
                    {formatINR(Number(p.price ?? 0))}
                  </span>
                  <Pill tone={Number(p.stock_qty ?? 0) <= 0 ? 'red' : Number(p.stock_qty ?? 0) <= 5 ? 'amber' : 'neutral'}>
                    {formatCount(Number(p.stock_qty ?? 0))} left
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-3">Recent activity in the shop</h2>
          {(activityRes.data ?? []).length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">Nothing yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {(activityRes.data ?? []).map((a, i) => (
                <li key={i} className="text-[14px] font-medium leading-relaxed">
                  {(a.summary as string) || (a.type as string)}
                  <span className="block text-[12px] text-[#86868B]">{timeAgo(a.created_at as string)}</span>
                </li>
              ))}
            </ul>
          )}
          {errorGroups.size > 0 ? (
            <div className="mt-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.07]">
              <h3 className="text-[14px] font-bold mb-2">Errors from this shop</h3>
              <ul className="space-y-1.5">
                {[...errorGroups.entries()].map(([digest, g]) => (
                  <li key={digest} className="text-[13px] font-medium">
                    <Link href={`/issues?digest=${encodeURIComponent(digest)}`} className="text-red-600 dark:text-red-400 font-semibold hover:underline underline-offset-4">
                      {g.title}
                    </Link>{' '}
                    · {g.count} reports · {g.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-4">Support notes</h2>
          <NotesPanel shopId={id} notes={notes} canWrite={can(admin.role, 'support_notes')} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
        {can(admin.role, 'plan_edit') || can(admin.role, 'finance_view') ? (
          <Card className="p-5">
            <h2 className="text-[16px] font-bold mb-4">Plan (finance lite)</h2>
            {can(admin.role, 'plan_edit') ? (
              <PlanForm
                shopId={id}
                plan={shop.plan as string}
                amount={Number(shop.plan_amount ?? 0)}
                status={shop.plan_status as string}
                nextDue={(shop.plan_next_due as string) ?? null}
              />
            ) : (
              <p className="text-[14px] font-medium">
                {(shop.plan as string).toUpperCase()} · {formatINR(Number(shop.plan_amount ?? 0))} ·{' '}
                {shop.plan_status as string}
                {shop.plan_next_due ? ` · next due ${formatDate(shop.plan_next_due as string)}` : ''}
              </p>
            )}
          </Card>
        ) : null}

        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-4">Account actions</h2>
          <ShopActions
            shopId={id}
            shopStatus={shop.status as string}
            canSuspend={can(admin.role, 'suspend_shop')}
            canAccount={can(admin.role, 'activation_actions')}
          />
          {(auditRes.data ?? []).length > 0 ? (
            <div className="mt-5 pt-4 border-t border-black/[0.05] dark:border-white/[0.07]">
              <h3 className="text-[14px] font-bold mb-2">Admin history on this shop</h3>
              <ul className="space-y-2">
                {(auditRes.data ?? []).map((a, i) => (
                  <li key={i} className="text-[13px] font-medium leading-relaxed">
                    {describeAction(a.action as string)}{' '}
                    <span className="text-[#86868B]">
                      by {a.admin_user_id ? adminName.get(a.admin_user_id as string) ?? 'team' : 'the system'} ·{' '}
                      {formatDateTime(a.created_at as string)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
