import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Shop Setup submit (plan Section 6C). The database does the real
 * work in admin_create_shop_tx: shop in pending_activation, owner
 * placeholder row, starter products, request moved to setup_done, and
 * the audit row, all in one transaction. A failure anywhere means no
 * half-created shop.
 */
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin('shop_setup')
  if (error) return error

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const shopName = String(body.shop_name ?? '').trim()
  const ownerMobile = String(body.owner_mobile ?? '').trim()
  if (!shopName || !ownerMobile) {
    return NextResponse.json(
      { ok: false, error: 'Shop name and owner mobile are required.' },
      { status: 400 }
    )
  }

  const payload = {
    shop_name: shopName,
    category: String(body.category ?? 'other'),
    address: String(body.address ?? ''),
    state: String(body.state ?? ''),
    state_code: String(body.state_code ?? ''),
    gstin: String(body.gstin ?? ''),
    upi_id: String(body.upi_id ?? ''),
    include_upi_qr: body.include_upi_qr !== false,
    language: String(body.language ?? 'en'),
    logo_url: String(body.logo_url ?? ''),
    terms_conditions: String(body.terms_conditions ?? ''),
    owner_name: String(body.owner_name ?? ''),
    owner_mobile: ownerMobile,
    owner_email: String(body.owner_email ?? ''),
    products: Array.isArray(body.products) ? body.products : [],
    staff: Array.isArray(body.staff) ? body.staff : [],
    request_id: body.request_id ? String(body.request_id) : '',
  }

  const supabase = createAdminClient()
  const { data, error: rpcError } = await supabase.rpc('admin_create_shop_tx', {
    p_admin_id: admin.id,
    p_payload: payload,
  })

  if (rpcError) {
    const known: Record<string, string> = {
      shop_name_required: 'Shop name is required.',
      owner_mobile_required: 'Owner mobile is required.',
      admin_not_active: 'Your admin access is not active.',
      admin_forbidden: 'Your role cannot set up shops.',
    }
    const key = Object.keys(known).find((k) => rpcError.message.includes(k))
    return NextResponse.json(
      { ok: false, error: key ? known[key] : 'Setup failed. Nothing was created; try again.' },
      { status: 400 }
    )
  }

  // The landing status depends on who created the shop (migration
  // 0022): founder-level creators are approved inline, teammate
  // setups wait in awaiting_approval. Report it so the Studio can
  // show the right next step.
  const { data: created } = await supabase
    .from('shops')
    .select('status')
    .eq('id', data as string)
    .single()

  return NextResponse.json({
    ok: true,
    shop_id: data,
    status: (created?.status as string) ?? 'pending_activation',
  })
}
