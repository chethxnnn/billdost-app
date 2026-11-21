import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * The founder approval gate (Nov 22). A shop a teammate prepared
 * sits in awaiting_approval: no activation token can be issued for
 * it (admin_issue_activation_tx refuses anything that is not
 * pending_activation, and only founder-level roles may call it).
 *
 *  - approve:    awaiting_approval -> pending_activation (founder-level)
 *  - send_back:  awaiting_approval -> setup_returned, with a note
 *                the preparer sees (founder-level)
 *  - mark_ready: setup_returned -> awaiting_approval (whoever can
 *                run setup; the fixes are done, review again)
 *
 * Every move is audit-logged with who and when, so the founder's
 * activity feed shows the whole trail.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = (await req.json().catch(() => null)) as {
    action?: string
    note?: string
  } | null
  const action = body?.action ?? ''

  const capability =
    action === 'mark_ready' ? 'shop_setup' : 'activation_approve'
  const { admin, error } = await requireAdmin(capability)
  if (error) return error

  if (!['approve', 'send_back', 'mark_ready'].includes(action)) {
    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
  }
  const note = (body?.note ?? '').trim()
  if (action === 'send_back' && !note) {
    return NextResponse.json(
      { ok: false, error: 'Write what needs fixing. The preparer sees this note.' },
      { status: 400 }
    )
  }

  const { id: shopId } = await params
  const supabase = createAdminClient()
  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, status')
    .eq('id', shopId)
    .single()
  if (!shop) {
    return NextResponse.json({ ok: false, error: 'Shop not found.' }, { status: 404 })
  }

  const from =
    action === 'mark_ready' ? 'setup_returned' : 'awaiting_approval'
  if (shop.status !== from) {
    return NextResponse.json(
      { ok: false, error: `This shop is ${shop.status}, not waiting for this step. Refresh the page.` },
      { status: 409 }
    )
  }

  const next =
    action === 'approve'
      ? 'pending_activation'
      : action === 'send_back'
        ? 'setup_returned'
        : 'awaiting_approval'

  const update: Record<string, unknown> = {
    status: next,
    setup_reviewed_at: new Date().toISOString(),
  }
  if (action === 'send_back') {
    update.setup_review_note = note
    update.setup_reviewed_by = admin.id
  }
  if (action === 'approve') {
    update.setup_review_note = null
    update.setup_reviewed_by = admin.id
  }

  const { error: updateError } = await supabase
    .from('shops')
    .update(update)
    .eq('id', shopId)
    .eq('status', from)

  if (updateError) {
    return NextResponse.json({ ok: false, error: 'Could not save. Try again.' }, { status: 500 })
  }

  const auditAction =
    action === 'approve'
      ? 'shop_approved'
      : action === 'send_back'
        ? 'shop_sent_back'
        : 'shop_marked_ready'
  await writeAudit(admin, auditAction, {
    shopId,
    details: {
      shop_name: shop.name,
      ...(action === 'send_back' ? { note } : {}),
    },
  })

  return NextResponse.json({ ok: true, status: next })
}
