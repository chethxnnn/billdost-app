import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Password reset, the only way it ever happens (plan Sections 3 and
 * 12): a link. The portal generates a Supabase recovery link for the
 * owner's account and hands it to the admin to send. Nobody at
 * BillDost sees or sets the owner's password, here or anywhere.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await requireAdmin('activation_actions')
  if (error) return error

  const { id: shopId } = await params
  const supabase = createAdminClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, email, owner_id, status')
    .eq('id', shopId)
    .single()

  if (!shop) {
    return NextResponse.json({ ok: false, error: 'Shop not found.' }, { status: 404 })
  }
  if (!shop.owner_id || !shop.email) {
    return NextResponse.json(
      { ok: false, error: 'This shop has no owner account yet. Send the activation link instead.' },
      { status: 409 }
    )
  }

  const shopAppUrl =
    process.env.NEXT_PUBLIC_SHOP_APP_URL ?? 'https://app.billdost.in'
  const { data, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: shop.email as string,
    options: { redirectTo: `${shopAppUrl}/auth/callback?next=/reset-password` },
  })

  if (linkError || !data?.properties?.action_link) {
    return NextResponse.json(
      { ok: false, error: 'Could not create the reset link. Try again.' },
      { status: 500 }
    )
  }

  await writeAudit(admin, 'password_reset_link_created', {
    shopId,
    details: { shop_name: shop.name },
  })

  return NextResponse.json({ ok: true, link: data.properties.action_link })
}
