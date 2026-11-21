import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Presence heartbeat. The portal shell pings this at most once every
 * two minutes while the app is open; the update itself is throttled
 * in the database write (only when the stored value is older than
 * two minutes), so a chatty client can never hammer the row. Team
 * presence ("active now") reads admin_users.last_active_at.
 */
export async function POST() {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  await supabase
    .from('admin_users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', admin.id)
    .or(`last_active_at.is.null,last_active_at.lt.${cutoff}`)
  return NextResponse.json({ ok: true })
}
