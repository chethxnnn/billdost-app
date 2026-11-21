import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * One assignment door for the three assignable things: an access
 * request, a shop (its support owner), and an issue group (by
 * digest). Every assign, claim and unassign writes the audit log:
 * who owns what is a fact the whole team can see, never a private
 * arrangement. Claiming stamps claimed_at; unassigning clears the
 * work state with it.
 */
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin('assign')
  if (error) return error

  const body = (await req.json().catch(() => null)) as {
    entity?: string
    id?: string
    assignee_id?: string | null
  } | null

  const entity = body?.entity ?? ''
  const id = body?.id ?? ''
  const assigneeId = body?.assignee_id ?? null
  if (!['request', 'shop', 'issue'].includes(entity) || !id) {
    return NextResponse.json({ ok: false, error: 'Invalid assignment.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let assigneeName: string | null = null
  if (assigneeId) {
    const { data: member } = await supabase
      .from('admin_users')
      .select('id, display_name, status')
      .eq('id', assigneeId)
      .single()
    if (!member || member.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: 'That team member is not active.' },
        { status: 400 }
      )
    }
    assigneeName = member.display_name as string
  }

  const now = new Date().toISOString()
  const stamp = assigneeId ? now : null

  if (entity === 'request') {
    const { data: row } = await supabase
      .from('access_requests')
      .select('id, shop_name')
      .eq('id', id)
      .single()
    if (!row) return NextResponse.json({ ok: false, error: 'Request not found.' }, { status: 404 })
    const { error: upd } = await supabase
      .from('access_requests')
      .update({
        assignee_id: assigneeId,
        claimed_at: stamp,
        ...(assigneeId ? {} : { started_at: null }),
      })
      .eq('id', id)
    if (upd) return NextResponse.json({ ok: false, error: 'Could not save.' }, { status: 500 })
    await writeAudit(admin, 'request_assigned', {
      requestId: id,
      details: { shop_name: row.shop_name, assignee_id: assigneeId, assignee_name: assigneeName },
    })
  } else if (entity === 'shop') {
    const { data: row } = await supabase
      .from('shops')
      .select('id, name')
      .eq('id', id)
      .single()
    if (!row) return NextResponse.json({ ok: false, error: 'Shop not found.' }, { status: 404 })
    const { error: upd } = await supabase
      .from('shops')
      .update({ support_owner_id: assigneeId })
      .eq('id', id)
    if (upd) return NextResponse.json({ ok: false, error: 'Could not save.' }, { status: 500 })
    await writeAudit(admin, 'shop_owner_assigned', {
      shopId: id,
      details: { shop_name: row.name, assignee_id: assigneeId, assignee_name: assigneeName },
    })
  } else {
    const { data: rows } = await supabase
      .from('client_errors')
      .select('id')
      .eq('digest', id)
      .limit(1)
    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Issue not found.' }, { status: 404 })
    }
    const { error: upd } = await supabase
      .from('client_errors')
      .update({
        assignee_id: assigneeId,
        claimed_at: stamp,
        ...(assigneeId ? {} : { started_at: null }),
      })
      .eq('digest', id)
    if (upd) return NextResponse.json({ ok: false, error: 'Could not save.' }, { status: 500 })
    await writeAudit(admin, 'issue_assigned', {
      details: { digest: id, assignee_id: assigneeId, assignee_name: assigneeName },
    })
  }

  return NextResponse.json({ ok: true })
}
