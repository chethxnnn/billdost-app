import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAdmin } from '@/lib/auth'
import Shell from '@/components/Shell'
import NoAccess from '@/components/NoAccess'

/**
 * The portal guard. No session: the proxy already sent them to
 * /login; this is the second lock. Session but not an active admin:
 * the calm no-access wall. Active admin: the shell, which then never
 * remounts between screens.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = await getCurrentAdmin()
  if (!admin) {
    return <NoAccess email={user.email ?? ''} />
  }

  return (
    <Shell
      admin={{
        displayName: admin.displayName,
        email: admin.email,
        role: admin.role,
        uiTheme: admin.uiTheme,
      }}
    >
      {children}
    </Shell>
  )
}
