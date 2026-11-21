import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export const CALL_OUTCOMES = [
  'answered',
  'no_answer',
  'busy',
  'callback_requested',
  'not_interested',
  'converted',
  'other',
] as const

/**
 * Log a call (one tap, outcome chips, optional note). The row lands
 * in call_logs and in the audit log, so Team stats and the activity
 * timeline both see it. A call is a fact about work done; it never
 * moves a pipeline status by itself.
 */
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin('call_log')
  if (error) return error

  const body = (await req.json().catch(() => null)) as {
    request_id?: string | null
    shop_id?: string | null
    outcome?: string
    note?: string
  } | null

  const outcome = body?.outcome ?? ''
  if (!(CALL_OUTCOMES as readonly string[]).includes(outcome)) {
    return NextResponse.json({ ok: false, error: 'Pick an outcome.' }, { status: 400 })
  }
  const requestId = body?.request_id || null
  const shopId = body?.shop_id || null
  if (!requestId && !shopId) {
    return NextResponse.json(
      { ok: false, error: 'A call must belong to a shop or a request.' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { error: insertError } = await supabase.from('call_logs').insert({
    admin_id: admin.id,
    request_id: requestId,
    shop_id: shopId,
    outcome,
    note: body?.note?.trim() || null,
  })
  if (insertError) {
    return NextResponse.json({ ok: false, error: 'Could not save the call.' }, { status: 500 })
  }

  await writeAudit(admin, 'call_logged', {
    requestId,
    shopId,
    details: { outcome, note: body?.note?.trim() || undefined },
  })

  return NextResponse.json({ ok: true })
}
