import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { isAdminRole, type AdminRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

/**
 * Team management (plan Sections 6H and 12). Founder-only in effect
 * for anything touching a founder account: a co-founder can manage
 * the team but can neither create another founder nor disable or
 * re-role the founder. Disabling is instant and deletes nothing.
 */
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin('team_manage')
  if (error) return error

  const body = (await req.json().catch(() => null)) as {
    email?: string
    display_name?: string
    role?: string
    password?: string
  } | null

  const email = (body?.email ?? '').trim().toLowerCase()
  const displayName = (body?.display_name ?? '').trim()
  const role = body?.role ?? ''
  const password = body?.password ?? ''

  if (!email || !displayName || !isAdminRole(role)) {
    return NextResponse.json(
      { ok: false, error: 'Name, email and a valid role are required.' },
      { status: 400 }
    )
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: 'Set a starting password of at least 8 characters. They can change it later.' },
      { status: 400 }
    )
  }
  if (role === 'founder' && admin.role !== 'founder') {
    return NextResponse.json(
      { ok: false, error: 'Only the founder can add another founder.' },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  })
  if (createError || !created?.user) {
    return NextResponse.json(
      { ok: false, error: 'Could not create the login. The email may already be in use.' },
      { status: 400 }
    )
  }

  const { data: row, error: insertError } = await supabase
    .from('admin_users')
    .insert({
      auth_user_id: created.user.id,
      display_name: displayName,
      email,
      role: role as AdminRole,
      status: 'active',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json(
      { ok: false, error: 'Login created but the team record failed. Ask the founder to check.' },
      { status: 500 }
    )
  }

  await writeAudit(admin, 'team_member_added', {
    details: { email, role, admin_user_id: row.id },
  })

  return NextResponse.json({ ok: true, id: row.id })
}

export async function PATCH(req: NextRequest) {
  const { admin, error } = await requireAdmin('team_manage')
  if (error) return error

  const body = (await req.json().catch(() => null)) as {
    id?: string
    status?: string
    role?: string
  } | null
  if (!body?.id) {
    return NextResponse.json({ ok: false, error: 'Missing member id.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: target } = await supabase
    .from('admin_users')
    .select('id, email, role, status')
    .eq('id', body.id)
    .single()
  if (!target) {
    return NextResponse.json({ ok: false, error: 'Member not found.' }, { status: 404 })
  }

  // The founder account is untouchable by anyone but the founder, and
  // nobody can disable or re-role themselves out of a lockout.
  if (target.role === 'founder' && admin.role !== 'founder') {
    return NextResponse.json(
      { ok: false, error: 'Only the founder can change the founder account.' },
      { status: 403 }
    )
  }
  if (target.id === admin.id && (body.status === 'disabled' || (body.role && body.role !== 'founder'))) {
    return NextResponse.json(
      { ok: false, error: 'You cannot disable or re-role your own account.' },
      { status: 400 }
    )
  }
  if (body.role === 'founder' && admin.role !== 'founder') {
    return NextResponse.json(
      { ok: false, error: 'Only the founder can promote someone to founder.' },
      { status: 403 }
    )
  }

  const update: Record<string, unknown> = {}
  if (body.status === 'active' || body.status === 'disabled') update.status = body.status
  if (body.role && isAdminRole(body.role)) update.role = body.role
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'Nothing to change.' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('admin_users')
    .update(update)
    .eq('id', body.id)
  if (updateError) {
    return NextResponse.json({ ok: false, error: 'Could not save.' }, { status: 500 })
  }

  await writeAudit(admin, 'team_member_updated', {
    details: { email: target.email, ...update },
  })
  return NextResponse.json({ ok: true })
}
