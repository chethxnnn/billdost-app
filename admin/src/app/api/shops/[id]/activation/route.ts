import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateActivationToken, hashActivationToken } from '@/lib/tokens'
import { sendActivationMessage, whatsappConfigured } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

/**
 * Issue (or re-issue) an activation link (plan Section 4). The raw
 * token is generated here, hashed, and only the hash reaches the
 * database through admin_issue_activation_tx, which also kills every
 * earlier live token for the shop. The raw link is returned once, for
 * copying, and sent on WhatsApp when the channel is whatsapp and the
 * Cloud API is configured. When WhatsApp is not configured, the
 * honest answer is the link itself plus a not-connected note, never a
 * fake "sent".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await requireAdmin('activation_actions')
  if (error) return error

  const { id: shopId } = await params
  const body = (await req.json().catch(() => null)) as { channel?: string } | null
  const channel = body?.channel === 'whatsapp' ? 'whatsapp' : 'manual'

  const supabase = createAdminClient()
  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, status')
    .eq('id', shopId)
    .single()

  if (!shop) {
    return NextResponse.json({ ok: false, error: 'Shop not found.' }, { status: 404 })
  }
  if (shop.status !== 'pending_activation') {
    return NextResponse.json(
      { ok: false, error: 'This shop is not waiting for activation.' },
      { status: 409 }
    )
  }

  const { data: ownerRow } = await supabase
    .from('staff_members')
    .select('name, phone')
    .eq('shop_id', shopId)
    .eq('role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const rawToken = generateActivationToken()
  const { error: rpcError } = await supabase.rpc('admin_issue_activation_tx', {
    p_admin_id: admin.id,
    p_shop_id: shopId,
    p_token_hash: hashActivationToken(rawToken),
    p_send_channel: channel,
  })

  if (rpcError) {
    return NextResponse.json(
      { ok: false, error: 'Could not create the link. Try again.' },
      { status: 500 }
    )
  }

  const shopAppUrl =
    process.env.NEXT_PUBLIC_SHOP_APP_URL ?? 'https://app.billdost.in'
  const link = `${shopAppUrl}/activate/${rawToken}`

  let whatsapp: { sent: boolean; reason?: string } = { sent: false }
  if (channel === 'whatsapp') {
    if (!whatsappConfigured()) {
      whatsapp = {
        sent: false,
        reason: 'WhatsApp is not connected yet. Copy the link and send it yourself.',
      }
    } else {
      const { data: phoneRow } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'support_phone')
        .single()
      const result = await sendActivationMessage({
        toPhone: (ownerRow?.phone as string) ?? '',
        ownerName: (ownerRow?.name as string) ?? 'Namaste',
        shopName: shop.name as string,
        activationLink: link,
        supportPhone: (phoneRow?.value as string) || 'the BillDost team',
      })
      whatsapp = result.ok
        ? { sent: true }
        : { sent: false, reason: 'WhatsApp send failed. Copy the link and send it yourself.' }
    }
  }

  return NextResponse.json({ ok: true, link, whatsapp })
}
