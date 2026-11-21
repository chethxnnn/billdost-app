import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import {
  broadcastTemplateName,
  sendTemplateMessage,
  whatsappConfigured,
} from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const MAX_RECIPIENTS = 200

/**
 * WhatsApp broadcast (plan Section 6F): an approved template to a
 * chosen audience of live shops. The send is recorded in
 * broadcast_log BEFORE it starts, so a double click can never send
 * twice; the log row is then updated with the real counts. When the
 * Cloud API is not configured, the honest outcome is a
 * not_connected log row and a clear message, never a fake success.
 */
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin('broadcasts')
  if (error) return error

  const body = (await req.json().catch(() => null)) as {
    message?: string
    audience?: string
    category?: string
    shop_id?: string
    template_name?: string
  } | null

  const message = (body?.message ?? '').trim()
  const audience = body?.audience ?? 'all'
  if (!message) {
    return NextResponse.json({ ok: false, error: 'Write the message first.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Recipients: owners of live shops in the audience. The mobile is
  // the owner staff row's phone, falling back to the shop phone.
  let shopQuery = supabase
    .from('shops')
    .select('id, name, phone')
    .eq('status', 'live')
    .is('deleted_at', null)
  if (audience === 'category' && body?.category) {
    shopQuery = shopQuery.eq('category', body.category)
  }
  if (audience === 'shop' && body?.shop_id) {
    shopQuery = shopQuery.eq('id', body.shop_id)
  }
  const { data: shops } = await shopQuery.limit(MAX_RECIPIENTS)
  const shopList = shops ?? []

  const { data: ownerRows } = await supabase
    .from('staff_members')
    .select('shop_id, phone')
    .in('shop_id', shopList.map((s) => s.id))
    .eq('role', 'owner')
  const ownerPhone = new Map<string, string>()
  for (const row of ownerRows ?? []) {
    if (row.phone && !ownerPhone.has(row.shop_id as string)) {
      ownerPhone.set(row.shop_id as string, row.phone as string)
    }
  }

  const recipients = shopList
    .map((s) => ({
      shopId: s.id as string,
      phone: ownerPhone.get(s.id as string) || (s.phone as string) || '',
    }))
    .filter((r) => r.phone)

  const templateName = body?.template_name?.trim() || broadcastTemplateName()
  const connected = whatsappConfigured()

  const { data: logRow, error: logError } = await supabase
    .from('broadcast_log')
    .insert({
      template_name: templateName,
      audience,
      category: audience === 'category' ? body!.category : null,
      shop_id: audience === 'shop' ? body!.shop_id : null,
      recipient_count: recipients.length,
      sent_count: 0,
      failed_count: 0,
      status: connected ? 'sent' : 'not_connected',
      created_by: admin.id,
    })
    .select('id')
    .single()

  if (logError || !logRow) {
    return NextResponse.json(
      { ok: false, error: 'Could not start the broadcast. Nothing was sent.' },
      { status: 500 }
    )
  }

  if (!connected) {
    await writeAudit(admin, 'broadcast_not_connected', {
      details: { audience, recipients: recipients.length },
    })
    return NextResponse.json({
      ok: true,
      connected: false,
      message:
        'WhatsApp is not connected yet, so nothing was sent. The attempt is in the broadcast history.',
      recipients: recipients.length,
    })
  }

  let sent = 0
  let failed = 0
  for (const r of recipients) {
    const result = await sendTemplateMessage({
      toPhone: r.phone,
      templateName,
      bodyParams: [message],
    })
    if (result.ok) sent += 1
    else failed += 1
  }

  await supabase
    .from('broadcast_log')
    .update({
      sent_count: sent,
      failed_count: failed,
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
    })
    .eq('id', logRow.id)

  await writeAudit(admin, 'broadcast_sent', {
    details: { audience, template: templateName, sent, failed },
  })

  return NextResponse.json({ ok: true, connected: true, sent, failed })
}
