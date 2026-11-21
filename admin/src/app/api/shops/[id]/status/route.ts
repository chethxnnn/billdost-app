import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Suspend or reactivate a shop (plan Section 3). Suspension stops
 * logins and leaves every byte of data untouched; reactivation
 * restores access exactly as it was. Both demand a reason, and both
 * are audit-logged with it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await requireAdmin('suspend_shop')
  if (error) return error

  const { id: shopId } = await params
  const body = (await req.json().catch(() => null)) as {
    action?: string
    reason?: string
  } | null

  const action = body?.action
  const reason = (body?.reason ?? '').trim()
  if (action !== 'suspend' && action !== 'reactivate') {
    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json(
      { ok: false, error: 'A reason is required. It is recorded in the audit log.' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, status')
    .eq('id', shopId)
    .single()

  if (!shop) {
    return NextResponse.json({ ok: false, error: 'Shop not found.' }, { status: 404 })
  }

  if (action === 'suspend' && shop.status !== 'live') {
    return NextResponse.json(
      { ok: false, error: 'Only a live shop can be suspended.' },
      { status: 409 }
    )
  }
  if (action === 'reactivate' && shop.status !== 'suspended') {
    return NextResponse.json(
      { ok: false, error: 'This shop is not suspended.' },
      { status: 409 }
    )
  }

  const { error: updateError } = await supabase
    .from('shops')
    .update(
      action === 'suspend'
        ? { status: 'suspended', suspended_reason: reason, suspended_at: new Date().toISOString() }
        : { status: 'live', suspended_reason: null, suspended_at: null }
    )
    .eq('id', shopId)

  if (updateError) {
    return NextResponse.json({ ok: false, error: 'Could not save. Try again.' }, { status: 500 })
  }

  await writeAudit(admin, action === 'suspend' ? 'shop_suspended' : 'shop_reactivated', {
    shopId,
    details: { shop_name: shop.name, reason },
  })

  return NextResponse.json({ ok: true })
}
