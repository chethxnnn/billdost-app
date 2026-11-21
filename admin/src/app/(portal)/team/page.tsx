import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { PageHeader } from '@/components/ui'
import TeamManager, { type TeamMember } from '@/components/TeamManager'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'team_manage')) redirect('/dashboard')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('admin_users')
    .select('id, display_name, email, role, status')
    .order('created_at', { ascending: true })

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Who can enter this portal, and what each person may do. Every change is audit-logged."
      />
      <TeamManager
        members={(data ?? []) as TeamMember[]}
        currentAdminId={admin.id}
        currentRole={admin.role}
      />
    </div>
  )
}
