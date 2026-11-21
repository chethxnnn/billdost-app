import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * WhatsApp Cloud API webhook (blueprint C1).
 * GET: Meta's one-time verification handshake.
 * POST: delivery status updates. The HMAC signature is the endpoint's
 * only authentication and it is mandatory when WHATSAPP_APP_SECRET is
 * set. Statuses only ever move forward (queued, sent, delivered,
 * read); duplicate or out-of-order deliveries are no-ops, and failed
 * is accepted from any non-final state.
 */

const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Verification failed', { status: 403 })
}

function signatureValid(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return true // No secret configured yet (pre-launch setup).
  if (!header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const given = header.slice('sha256='.length)
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!signatureValid(rawBody, request.headers.get('x-hub-signature-256'))) {
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const statuses = change?.value?.statuses ?? []
      for (const status of statuses) {
        const messageId = status?.id
        const newStatus = status?.status
        if (!messageId || typeof newStatus !== 'string') continue

        const { data: row } = await supabase
          .from('whatsapp_sends')
          .select('id, status')
          .eq('provider_message_id', messageId)
          .single()
        if (!row) continue

        if (newStatus === 'failed') {
          if (row.status !== 'failed') {
            const errorText =
              status?.errors?.[0]?.title || status?.errors?.[0]?.message || 'Delivery failed'
            await supabase
              .from('whatsapp_sends')
              .update({ status: 'failed', error: String(errorText) })
              .eq('id', row.id)
          }
          continue
        }

        const newRank = STATUS_RANK[newStatus]
        const oldRank = STATUS_RANK[row.status as string]
        if (newRank === undefined || oldRank === undefined) continue
        if (newRank > oldRank) {
          await supabase
            .from('whatsapp_sends')
            .update({ status: newStatus })
            .eq('id', row.id)
        }
      }
    }
  }

  return new Response('OK', { status: 200 })
}
