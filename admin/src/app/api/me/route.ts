import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Who am I in the portal: used by the login page right after sign-in. */
export async function GET() {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'This area is for the BillDost team.' },
      { status: 403 }
    )
  }
  return NextResponse.json({ ok: true, admin })
}
