import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Support notes (plan Section 3): what was said on a call, written
 * down before the page closes. Visible to the team, never to the
 * shop. The audit log records that a note was added, not its text.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await requireAdmin('support_notes')
  if (error) return error

  const { id: shopId } = await params
  const body = (await req.json().catch(() => null)) as { note?: string } | null
  const note = (body?.note ?? '').trim()
  if (!note) {
    return NextResponse.json({ ok: false, error: 'Write the note first.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error: insertError } = await supabase.from('shop_support_notes').insert({
    shop_id: shopId,
    admin_user_id: admin.id,
    note,
  })

  if (insertError) {
    return NextResponse.json({ ok: false, error: 'Could not save the note.' }, { status: 500 })
  }

  await writeAudit(admin, 'support_note_added', { shopId })
  return NextResponse.json({ ok: true })
}
