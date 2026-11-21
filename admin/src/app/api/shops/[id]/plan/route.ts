import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const PLANS = ['free', 'standard', 'pro']
const PLAN_STATUSES = ['trial', 'active', 'due', 'overdue', 'cancelled']

/**
 * Finance lite plan edit (plan Section 6G, v1). A plan describes the
 * subscription only: this endpoint can never touch a shop's invoices
 * or totals, and it writes nothing outside the four plan fields.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await requireAdmin('plan_edit')
  if (error) return error

  const { id: shopId } = await params
  const body = (await req.json().catch(() => null)) as {
    plan?: string
    plan_amount?: number
    plan_status?: string
    plan_next_due?: string | null
  } | null

  if (
    !body ||
    !PLANS.includes(body.plan ?? '') ||
    !PLAN_STATUSES.includes(body.plan_status ?? '') ||
    typeof body.plan_amount !== 'number' ||
    body.plan_amount < 0
  ) {
    return NextResponse.json({ ok: false, error: 'Check the plan values.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, plan, plan_amount, plan_status')
    .eq('id', shopId)
    .single()
  if (!shop) {
    return NextResponse.json({ ok: false, error: 'Shop not found.' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('shops')
    .update({
      plan: body.plan,
      plan_amount: body.plan_amount,
      plan_status: body.plan_status,
      plan_next_due: body.plan_next_due || null,
    })
    .eq('id', shopId)

  if (updateError) {
    return NextResponse.json({ ok: false, error: 'Could not save the plan.' }, { status: 500 })
  }

  await writeAudit(admin, 'plan_updated', {
    shopId,
    details: {
      shop_name: shop.name,
      from: { plan: shop.plan, amount: shop.plan_amount, status: shop.plan_status },
      to: { plan: body.plan, amount: body.plan_amount, status: body.plan_status },
    },
  })

  return NextResponse.json({ ok: true })
}
