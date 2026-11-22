import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashActivationToken } from '@/lib/token-hash'

/**
 * Staff invite completion (Stage 4): the invitee sets their own
 * password and joins the shop. Server-side only, in this order:
 *   1. Hash the token and confirm it is still valid
 *      (staff_invite_lookup).
 *   2. If the invited email already belongs to a BillDost account,
 *      stop here with state account_exists: that person signs in
 *      instead, and accept_staff_invite attaches the membership.
 *   3. Create the auth account with the password the invitee typed,
 *      through the Supabase Admin API. Phone-only invites carry no
 *      email, so the join form collects one at this step.
 *   4. Burn the token and activate the staff row
 *      (staff_invite_consume_tx).
 * If step 4 fails because the token died between check and submit,
 * the fresh auth account simply has no membership yet: a fresh link
 * from the owner fixes everything.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function stateFromRpcError(message: string): string {
  if (message.includes('token_expired')) return 'expired'
  if (message.includes('token_used')) return 'used'
  if (message.includes('token_replaced')) return 'replaced'
  return 'invalid'
}

export async function POST(req: NextRequest) {
  let token = ''
  let password = ''
  let providedEmail = ''
  try {
    const body = await req.json()
    token = typeof body?.token === 'string' ? body.token : ''
    password = typeof body?.password === 'string' ? body.password : ''
    providedEmail =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return NextResponse.json({ ok: false, state: 'invalid' })
  }

  if (!token || token.length > 200) {
    return NextResponse.json({ ok: false, state: 'invalid' })
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, state: 'weak_password' })
  }

  const supabase = serviceClient()
  const tokenHash = hashActivationToken(token)

  const { data: lookupData, error: lookupError } = await supabase.rpc(
    'staff_invite_lookup',
    { p_token_hash: tokenHash }
  )
  if (lookupError || !lookupData) {
    return NextResponse.json({ ok: false, state: 'invalid' })
  }
  const lookup = lookupData as {
    state: string
    email?: string
    staff_name?: string
    account_exists?: boolean
  }
  if (lookup.state !== 'valid') {
    return NextResponse.json({ ok: false, state: lookup.state })
  }
  if (lookup.account_exists) {
    return NextResponse.json({ ok: false, state: 'account_exists' })
  }

  const email = (lookup.email ?? '').toLowerCase() || providedEmail
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, state: 'email_required' })
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: lookup.staff_name ?? '' },
    })

  if (!created?.user?.id) {
    if (
      createError &&
      /already/i.test(createError.message) &&
      /regist|exist/i.test(createError.message)
    ) {
      // The account appeared between lookup and submit (or the
      // lookup raced): the sign-in path is the right door.
      return NextResponse.json({ ok: false, state: 'account_exists' })
    }
    return NextResponse.json({ ok: false, state: 'error' })
  }

  const { error: consumeError } = await supabase.rpc(
    'staff_invite_consume_tx',
    { p_token_hash: tokenHash, p_auth_user_id: created.user.id }
  )
  if (consumeError) {
    return NextResponse.json({
      ok: false,
      state: stateFromRpcError(consumeError.message),
    })
  }

  return NextResponse.json({ ok: true, email })
}
