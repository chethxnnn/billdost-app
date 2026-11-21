import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { PageHeader } from '@/components/ui'
import BroadcastComposer from '@/components/BroadcastComposer'
import { broadcastTemplateName, whatsappConfigured } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function BroadcastsPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'broadcasts')) redirect('/dashboard')

  const supabase = createAdminClient()
  const [annRes, logRes, shopsRes] = await Promise.all([
    supabase
      .from('announcements')
      .select('id, title, body, audience, category, starts_at, ends_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('broadcast_log')
      .select('id, template_name, audience, recipient_count, sent_count, failed_count, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('shops')
      .select('id, name, category')
      .eq('status', 'live')
      .is('deleted_at', null)
      .order('name')
      .limit(300),
  ])

  const shops = shopsRes.data ?? []
  const categories = [...new Set(shops.map((s) => s.category as string))].sort()

  return (
    <div>
      <PageHeader
        title="Broadcasts"
        subtitle="Announcements inside the app, and WhatsApp broadcasts through the official Cloud API. Both are logged."
      />
      <BroadcastComposer
        announcements={(annRes.data ?? []) as never[]}
        log={(logRes.data ?? []) as never[]}
        shops={shops.map((s) => ({ id: s.id as string, name: s.name as string }))}
        categories={categories}
        waConnected={whatsappConfigured()}
        waTemplate={broadcastTemplateName()}
      />
    </div>
  )
}
