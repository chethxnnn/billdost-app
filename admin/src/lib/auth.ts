import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { can, type AdminRole, type Capability } from '@/lib/roles'

export interface AdminProfile {
  id: string
  authUserId: string
  displayName: string
  email: string
  role: AdminRole
  uiTheme: 'light' | 'dark'
}

/**
 * Resolves the signed-in auth user to their admin profile, or null
 * when they are not an active admin. This is THE gate for the portal:
 * a shopkeeper's login is a perfectly good Supabase session and must
 * still get nothing here.
 */
export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_users')
    .select('id, auth_user_id, display_name, email, role, status, ui_theme')
    .eq('auth_user_id', user.id)
    .single()

  if (!data || data.status !== 'active') return null

  return {
    id: data.id as string,
    authUserId: data.auth_user_id as string,
    displayName: data.display_name as string,
    email: data.email as string,
    role: data.role as AdminRole,
    uiTheme: data.ui_theme === 'dark' ? 'dark' : 'light',
  }
}

/** For API routes: returns the admin or a ready JSON error response. */
export async function requireAdmin(
  capability?: Capability
): Promise<
  | { admin: AdminProfile; error: null }
  | { admin: null; error: Response }
> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return {
      admin: null,
      error: Response.json(
        { ok: false, error: 'This area is for the BillDost team.' },
        { status: 403 }
      ),
    }
  }
  if (capability && !can(admin.role, capability)) {
    return {
      admin: null,
      error: Response.json(
        { ok: false, error: 'Your role cannot do this. Ask the founder if you need access.' },
        { status: 403 }
      ),
    }
  }
  return { admin, error: null }
}
