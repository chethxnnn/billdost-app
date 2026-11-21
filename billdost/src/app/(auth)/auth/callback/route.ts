import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Password recovery links land here with a live session: the user
      // must set a new password before anything else (blueprint C13).
      if (type === 'recovery' || next === '/reset-password') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Invited staff first (blueprint B.9, C4): if this user has a
        // pending staff invite, accept_staff_invite flips the row to
        // active and returns the shop. This ordering is what stops
        // invited staff being pushed to create their own shop.
        const { data: invitedShopId } = await supabase.rpc('accept_staff_invite')
        if (invitedShopId) {
          return NextResponse.redirect(`${origin}${next}`)
        }

        const { data: shop } = await supabase
          .from('shops')
          .select('onboarding_done')
          .eq('owner_id', user.id)
          .single()

        // No shop yet or setup not done: BillDost is invite-only, so
        // there is no self-serve onboarding. The no-shop page explains.
        if (!shop || !shop.onboarding_done) {
          return NextResponse.redirect(`${origin}/no-shop`)
        }
      }

      // Onboarding done → go to requested page
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error → redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
