import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveShopAndRole } from '@/server/utils/auth'
import { buildTallyXml } from '@/lib/tally'
import { fetchGstRangeData, monthRange } from '@/server/gstr1Data'

/**
 * Tally XML download (blueprint D9): GET /api/exports/tally?month=YYYY-MM
 * Session-authenticated, manager and owner only. One Sales voucher
 * per active invoice in the month, from stored rows.
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
    return NextResponse.json({ error: 'Ye export manager aur owner ke liye hai' }, { status: 403 })
  }

  const { from, to } = monthRange(month)
  const data = await fetchGstRangeData(supabase, shop.id, from, to)
  const xml = buildTallyXml(data.tallyInvoices)

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="tally-sales-${month}.xml"`,
    },
  })
}
