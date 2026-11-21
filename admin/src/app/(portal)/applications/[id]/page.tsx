import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { Card, PageHeader, RequestStatusPill, ShopStatusPill } from '@/components/ui'
import RequestActions from '@/components/RequestActions'
import AssignControl from '@/components/AssignControl'
import CallLogForm, { CALL_OUTCOME_LABELS } from '@/components/CallLogForm'
import StartWorkButton from '@/components/StartWorkButton'
import { formatDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'applications')) redirect('/dashboard')

  const { id } = await params
  const supabase = createAdminClient()
  const { data: request } = await supabase
    .from('access_requests')
    .select('*')
    .eq('id', id)
    .single()
  if (!request) notFound()

  let shop: { id: string; name: string; status: string } | null = null
  if (request.converted_shop_id) {
    const { data } = await supabase
      .from('shops')
      .select('id, name, status')
      .eq('id', request.converted_shop_id as string)
      .single()
    shop = data
  }

  const { data: history } = await supabase
    .from('admin_audit_log')
    .select('action, details, created_at')
    .eq('request_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: members } = await supabase
    .from('admin_users')
    .select('id, display_name')
    .eq('status', 'active')
    .order('display_name')
  const memberOptions = (members ?? []).map((m) => ({
    id: m.id as string,
    name: m.display_name as string,
  }))
  const memberName = new Map(memberOptions.map((m) => [m.id, m.name]))

  const { data: callRows } = await supabase
    .from('call_logs')
    .select('outcome, note, admin_id, created_at')
    .eq('request_id', id)
    .order('created_at', { ascending: false })
    .limit(5)
  const calls = (callRows ?? []).map((c) => ({
    outcome: c.outcome as string,
    note: (c.note as string) ?? null,
    adminName: c.admin_id ? memberName.get(c.admin_id as string) ?? 'Team' : 'Team',
    created_at: c.created_at as string,
  }))

  const rows: [string, string][] = [
    ['Owner', request.owner_name as string],
    ['WhatsApp number', request.whatsapp_number as string],
    ['Category', request.category as string],
    ['City', (request.city as string) ?? 'Not given'],
    [
      'Approximate products',
      request.approx_products ? String(request.approx_products) : 'Not given',
    ],
    ['Received', formatDateTime(request.created_at as string)],
  ]

  return (
    <div>
      <PageHeader
        title={request.shop_name as string}
        subtitle="Access request"
        action={<RequestStatusPill status={request.status as string} />}
      />

      <Card className="p-5 md:p-6 mb-4">
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[12px] font-bold uppercase tracking-wide text-[#86868B]">
                {label}
              </dt>
              <dd className="text-[15px] font-semibold mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
        {request.note ? (
          <div className="mt-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#86868B]">Note from the shop</p>
            <p className="text-[15px] font-medium mt-0.5 leading-relaxed">&ldquo;{request.note as string}&rdquo;</p>
          </div>
        ) : null}
        {request.status === 'rejected' && request.rejection_reason ? (
          <div className="mt-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#86868B]">Rejection reason (internal)</p>
            <p className="text-[15px] font-medium mt-0.5">{request.rejection_reason as string}</p>
          </div>
        ) : null}
        <div className="mt-6 pt-5 border-t border-black/[0.05] dark:border-white/[0.07] flex flex-wrap items-center gap-x-5 gap-y-3">
          <AssignControl
            entity="request"
            id={request.id as string}
            assigneeId={(request.assignee_id as string) ?? null}
            members={memberOptions}
            currentAdminId={admin.id}
            canAssign={can(admin.role, 'assign')}
          />
          {request.started_at ? (
            <span className="text-[13px] font-bold text-[#14663C] dark:text-[#25D366]">
              In progress since {formatDateTime(request.started_at as string)}
            </span>
          ) : ['new', 'called', 'approved'].includes(request.status as string) ? (
            <StartWorkButton requestId={request.id as string} />
          ) : null}
        </div>
        <div className="mt-5 pt-5 border-t border-black/[0.05] dark:border-white/[0.07]">
          <RequestActions
            request={{
              id: request.id as string,
              status: request.status as string,
              whatsapp_number: request.whatsapp_number as string,
              converted_shop_id: (request.converted_shop_id as string) ?? null,
            }}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {can(admin.role, 'call_log') ? (
              <CallLogForm requestId={request.id as string} />
            ) : null}
          </div>
          {calls.length > 0 ? (
            <div className="mt-4">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#86868B] mb-1.5">
                Recent calls
              </p>
              <ul className="space-y-1.5">
                {calls.map((c, i) => (
                  <li key={i} className="text-[13px] font-medium">
                    <span className="font-bold">{CALL_OUTCOME_LABELS[c.outcome] ?? c.outcome}</span>
                    {c.note ? ` · ${c.note}` : ''}{' '}
                    <span className="text-[#86868B]">
                      by {c.adminName} · {formatDateTime(c.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Card>

      {shop ? (
        <Card className="p-5 md:p-6 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#86868B]">Converted shop</p>
              <Link href={`/shops/${shop.id}`} className="text-[17px] font-bold hover:underline underline-offset-4">
                {shop.name}
              </Link>
            </div>
            <ShopStatusPill status={shop.status} />
          </div>
        </Card>
      ) : null}

      {(history ?? []).length > 0 ? (
        <Card className="p-5 md:p-6">
          <h2 className="text-[16px] font-bold mb-3">History</h2>
          <ul className="space-y-2.5">
            {(history ?? []).map((h, i) => (
              <li key={i} className="text-[14px] font-medium flex flex-wrap gap-x-3">
                <span className="font-semibold">{(h.action as string).replace(/_/g, ' ')}</span>
                <span className="text-[#86868B]">{formatDateTime(h.created_at as string)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
