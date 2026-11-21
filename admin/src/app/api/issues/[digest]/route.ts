import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'investigating', 'fixed', 'informed']

/**
 * Issue workflow (plan Section 6E): one bug, one row in the portal,
 * however many reports sit behind it. Changing the status updates
 * every report in the digest group together, and "informed" is a
 * deliberate step: it means the affected shops have been told.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ digest: string }> }
) {
  const { admin, error } = await requireAdmin('issues_status')
  if (error) return error

  const { digest } = await params
  const body = (await req.json().catch(() => null)) as {
    issue_status?: string
    internal_note?: string
  } | null

  if (!body?.issue_status || !STATUSES.includes(body.issue_status)) {
    return NextResponse.json({ ok: false, error: 'Pick a valid status.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const update: Record<string, unknown> = { issue_status: body.issue_status }
  if (typeof body.internal_note === 'string') {
    update.internal_note = body.internal_note.trim() || null
  }

  const { data, error: updateError } = await supabase
    .from('client_errors')
    .update(update)
    .eq('digest', digest)
    .select('id')

  if (updateError) {
    return NextResponse.json({ ok: false, error: 'Could not save.' }, { status: 500 })
  }

  await writeAudit(admin, `issue_${body.issue_status}`, {
    details: { digest, reports: data?.length ?? 0 },
  })

  return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
}
