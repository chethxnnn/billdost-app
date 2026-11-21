import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashActivationToken } from '@/lib/token-hash'

/**
 * Activation link check. The browser never talks to the token table:
 * this server endpoint hashes the presented token and asks the
 * activation_lookup RPC (service role) for its state, then returns
 * only what the activation page is allowed to show. The support phone
 * from platform_settings rides along so dead-link screens can offer
 * the call, per the plan.
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

  const { data, error } = await supabase.rpc('activation_lookup', {
    p_token_hash: hashActivationToken(token),
  })

  if (error || !data) {
    return NextResponse.json({ state: 'invalid', support_phone: supportPhone })
  }

  const lookup = data as {
    state: string
    shop_name?: string
    owner_name?: string
    login_email?: string
  }

  // The login email is only revealed for a live token; dead states get
  // nothing but the state itself.
  return NextResponse.json({
    state: lookup.state,
    shop_name: lookup.state === 'valid' ? lookup.shop_name ?? '' : '',
    owner_name: lookup.state === 'valid' ? lookup.owner_name ?? '' : '',
    support_phone: supportPhone,
  })
}
