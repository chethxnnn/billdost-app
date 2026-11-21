import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/** Who am I in the portal: used by the login page right after sign-in. */
export async function GET() {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'This area is for the BillDost team.' },
      { status: 403 }
    )
  }
  return NextResponse.json({ ok: true, admin })
}

/**
 * My own profile: display name and the manual theme choice. An admin
 * can only ever edit their own row here; team management (roles,
 * status, other people) lives in /api/team behind team_manage.
 */
export async function PATCH(req: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'This area is for the BillDost team.' },
      { status: 403 }
    )
  }

  const body = (await req.json().catch(() => null)) as {
    display_name?: string
    ui_theme?: string
  } | null
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof body.display_name === 'string') {
    const name = body.display_name.trim()
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { ok: false, error: 'Name should be 2 to 80 characters.' },
        { status: 400 }
      )
    }
    update.display_name = name
  }
  if (typeof body.ui_theme === 'string') {
    if (body.ui_theme !== 'light' && body.ui_theme !== 'dark') {
      return NextResponse.json({ ok: false, error: 'Pick light or dark.' }, { status: 400 })
    }
    update.ui_theme = body.ui_theme
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'Nothing to save.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('admin_users')
    .update(update)
    .eq('id', admin.id)
  if (error) {
    return NextResponse.json({ ok: false, error: 'Could not save. Try again.' }, { status: 500 })
  }

  if (update.display_name) {
    await writeAudit(admin, 'profile_updated', {
      details: { display_name: update.display_name },
    })
  }

  return NextResponse.json({ ok: true })
}
