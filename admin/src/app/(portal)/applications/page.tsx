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
      'id, shop_name, owner_name, whatsapp_number, category, city, approx_products, note, status, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Requests from the website, in pipeline order. Call first, decide second."
      />
      <RequestsBoard
        requests={(data ?? []) as RequestRow[]}
        initialStatus={status}
      />
    </div>
  )
}
