import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Customer (buyer) data is masked by default in the portal (plan
 * Sections 6D and 12). Only the founder may unmask, and every unmask
 * is written to the audit log with the shop it belonged to.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await requireAdmin('unmask')
  if (error) return error

  const { id: shopId } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, total_billed, total_paid, opening_balance')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .order('total_billed', { ascending: false })
    .limit(10)

  await writeAudit(admin, 'customer_data_unmasked', { shopId })

  return NextResponse.json({ ok: true, customers: data ?? [] })
}
