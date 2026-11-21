import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveShopAndRole } from '@/server/utils/auth'
import { buildGstr1 } from '@/lib/gstr1'
import { fetchGstRangeData, monthRange } from '@/server/gstr1Data'

/**
 * GSTR-1 JSON download (blueprint D9): GET /api/exports/gstr1?month=YYYY-MM
 * Session-authenticated, manager and owner only. Returns exactly the
 * document reports.getGstr1 builds for the same month.
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month') || ''
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month query param chahiye, format YYYY-MM' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  let shop: any
  let role: string
  try {
    const resolved = await resolveShopAndRole(supabase, user.id)
    shop = resolved.shop
    role = resolved.role
  } catch {
    return NextResponse.json({ error: 'Shop access nahi hai' }, { status: 403 })
  }
  if (role === 'cashier') {
    return NextResponse.json({ error: 'Ye report manager aur owner ke liye hai' }, { status: 403 })
  }

  const { from, to, fp } = monthRange(month)
  const data = await fetchGstRangeData(supabase, shop.id, from, to)
  const doc = buildGstr1({
    shop_gstin: shop.gstin || null,
    shop_state_code: shop.state_code || null,
    fp,
    invoices: data.gstr1Invoices,
    credit_notes: data.creditNotes,
  })

  return new NextResponse(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="gstr1-${month}.json"`,
    },
  })
}
