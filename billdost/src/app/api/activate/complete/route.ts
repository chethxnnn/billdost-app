import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashActivationToken } from '@/lib/token-hash'

/**
 * Activation completion: the moment a shop is born (Admin Portal plan,
 * Section 4). Server-side only, in this order:
 *   1. Hash the token and confirm it is still valid (activation_lookup).
 *   2. Create the owner's auth account with the password HE typed,
 *      through the Supabase Admin API. The password goes to the auth
 *      system only; nobody at BillDost ever sees or stores it.
 *   3. Burn the token and link the account as owner
 *      (activation_consume_tx).
 * If step 3 fails because the token died between check and submit,
 * the fresh auth account simply has no shop: the owner lands on the
 * calm no-shop page if he logs in, and a fresh link fixes everything.
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
  if (message.includes('shop_not_pending')) return 'used'
  return 'invalid'
}

export async function POST(req: NextRequest) {
  let token = ''
  let password = ''
  try {
    const body = await req.json()
    token = typeof body?.token === 'string' ? body.token : ''
    password = typeof body?.password === 'string' ? body.password : ''
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
    'activation_lookup',
    { p_token_hash: tokenHash }
  )
  if (lookupError || !lookupData) {
    return NextResponse.json({ ok: false, state: 'invalid' })
  }
  const lookup = lookupData as {
    state: string
    login_email?: string
    owner_name?: string
  }
  if (lookup.state !== 'valid' || !lookup.login_email) {
    return NextResponse.json({ ok: false, state: lookup.state })
  }

  const email = lookup.login_email

  // Create the auth account, or adopt the one a previous half-finished
  // attempt created (same email, still no shop attached).
  let userId: string | null = null
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: lookup.owner_name ?? '' },
    })

  if (created?.user?.id) {
    userId = created.user.id
  } else if (
    createError &&
    /already/i.test(createError.message) &&
    /regist|exist/i.test(createError.message)
  ) {
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    const existing = list?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )
    if (existing) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existing.id,
        { password, email_confirm: true }
      )
      if (!updateError) userId = existing.id
    }
  }

  if (!userId) {
    return NextResponse.json({ ok: false, state: 'error' })
  }

  const { error: consumeError } = await supabase.rpc(
    'activation_consume_tx',
    { p_token_hash: tokenHash, p_auth_user_id: userId }
  )
  if (consumeError) {
    return NextResponse.json({
      ok: false,
      state: stateFromRpcError(consumeError.message),
    })
  }

  return NextResponse.json({ ok: true, email })
}
