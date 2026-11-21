import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { PageHeader } from '@/components/ui'
import SetupForm from '@/components/SetupForm'

export const dynamic = 'force-dynamic'

export default async function ShopSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>
}) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'shop_setup')) redirect('/dashboard')

  const { request: requestId } = await searchParams
  let initial = {}

  if (requestId) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('access_requests')
      .select('id, shop_name, owner_name, whatsapp_number, category, city')
      .eq('id', requestId)
      .single()
    if (data) {
      initial = {
        requestId: data.id as string,
        shopName: data.shop_name as string,
        ownerName: data.owner_name as string,
        ownerMobile: data.whatsapp_number as string,
        category: data.category as string,
        city: (data.city as string) ?? '',
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Setup Studio"
        subtitle="Fill this during or just after the call. The preview shows what the shopkeeper will see, as you type."
      />
      <SetupForm initial={initial} canActivate={can(admin.role, 'activation_actions')} />
    </div>
  )
}
