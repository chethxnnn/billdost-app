import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { PageHeader } from '@/components/ui'
import ProfileForm from '@/components/ProfileForm'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')

  return (
    <div>
      <PageHeader title="My profile" subtitle="How you appear to the team, and your own settings." />
      <ProfileForm
        displayName={admin.displayName}
        email={admin.email}
        role={admin.role}
        uiTheme={admin.uiTheme}
      />
    </div>
  )
}
