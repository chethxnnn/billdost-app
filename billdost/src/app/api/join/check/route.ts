import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashActivationToken } from '@/lib/token-hash'

/**
 * Staff invite link check (Stage 4). Like the shop activation check,
 * the browser never talks to the token table: this server endpoint
 * hashes the presented token and asks staff_invite_lookup (service
 * role) for its state. The invited email is only revealed for a live
 * token; account_exists tells the join page to offer the sign-in
 * path instead of the password form.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  let token = ''
  try {
    const body = await req.json()
    token = typeof body?.token === 'string' ? body.token : ''
  } catch {
    return NextResponse.json({ state: 'invalid', support_phone: '' })
  }
  if (!token || token.length > 200) {
    return NextResponse.json({ state: 'invalid', support_phone: '' })
  }

  const supabase = serviceClient()

  const { data: phoneRow } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'support_phone')
    .single()
  const supportPhone = (phoneRow?.value as string) ?? ''

  const { data, error } = await supabase.rpc('staff_invite_lookup', {
    p_token_hash: hashActivationToken(token),
  })

  if (error || !data) {
    return NextResponse.json({ state: 'invalid', support_phone: supportPhone })
  }

  const lookup = data as {
    state: string
    shop_name?: string
    staff_name?: string
    role?: string
    email?: string
    has_email?: boolean
    account_exists?: boolean
  }

  const valid = lookup.state === 'valid'
  return NextResponse.json({
    state: lookup.state,
    support_phone: supportPhone,
    shop_name: valid ? (lookup.shop_name ?? '') : '',
    staff_name: valid ? (lookup.staff_name ?? '') : '',
    role: valid ? (lookup.role ?? '') : '',
    email: valid ? (lookup.email ?? '') : '',
    has_email: valid ? Boolean(lookup.has_email) : false,
    account_exists: valid ? Boolean(lookup.account_exists) : false,
  })
}
