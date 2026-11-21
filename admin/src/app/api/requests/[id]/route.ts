import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED: Record<string, string[]> = {
  called: ['new', 'called'],
  approved: ['new', 'called', 'approved'],
  rejected: ['new', 'called', 'approved'],
}

/**
 * Move an access request along the pipeline (plan Section 3):
 * new, called, approved, rejected. setup_done, activation_sent and
 * live are reached only through the setup and activation RPCs, never
 * by hand, so the pipeline can never claim a shop exists when it does
 * not.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await requireAdmin('applications')
  if (error) return error

  const { id } = await params
  const body = (await req.json().catch(() => null)) as {
    status?: string
    rejection_reason?: string
    action?: string
  } | null

  const supabase = createAdminClient()

  // Start work on this request: stamps started_at so the Team
  // screen can show who is doing what, right now.
  if (body?.action === 'start') {
    const { data: row } = await supabase
      .from('access_requests')
      .select('id, shop_name')
      .eq('id', id)
      .single()
    if (!row) {
      return NextResponse.json({ ok: false, error: 'Request not found.' }, { status: 404 })
    }
    const { error: startError } = await supabase
      .from('access_requests')
      .update({ started_at: new Date().toISOString() })
      .eq('id', id)
      .is('started_at', null)
    if (startError) {
      return NextResponse.json({ ok: false, error: 'Could not save.' }, { status: 500 })
    }
    await writeAudit(admin, 'request_started', {
      requestId: id,
      details: { shop_name: row.shop_name },
    })
    return NextResponse.json({ ok: true })
  }

  const next = body?.status ?? ''
  if (!ALLOWED[next]) {
    return NextResponse.json(
      { ok: false, error: 'That move is not allowed from here.' },
      { status: 400 }
    )
  }
  if (next === 'rejected' && !body?.rejection_reason?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'A short reason is needed when rejecting. It stays internal.' },
      { status: 400 }
    )
  }

  const { data: current } = await supabase
    .from('access_requests')
    .select('status, shop_name')
    .eq('id', id)
    .single()

  if (!current) {
    return NextResponse.json({ ok: false, error: 'Request not found.' }, { status: 404 })
  }
  if (!ALLOWED[next].includes(current.status as string)) {
    return NextResponse.json(
      { ok: false, error: `This request is already ${current.status}. Refresh the page.` },
      { status: 409 }
    )
  }

  const { error: updateError } = await supabase
    .from('access_requests')
    .update({
      status: next,
      rejection_reason: next === 'rejected' ? body!.rejection_reason!.trim() : null,
      // Advancing the pipeline ends the current work stint.
      started_at: null,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ ok: false, error: 'Could not save. Try again.' }, { status: 500 })
  }

  await writeAudit(admin, `request_${next}`, {
    requestId: id,
    details: {
      shop_name: current.shop_name,
      ...(next === 'rejected' ? { reason: body!.rejection_reason!.trim() } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}
