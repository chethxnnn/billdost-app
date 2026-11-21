'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * The calm wall for a signed-in user who is not an active admin: a
 * shopkeeper who wandered here, or a team member whose access was
 * disabled. One message, one action.
 */
export default function NoAccess({ email }: { email: string }) {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[24px] p-8 text-center page-enter">
        <h1 className="text-[22px] font-extrabold tracking-tight mb-2">
          This area is for the BillDost team
        </h1>
        <p className="text-[15px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed mb-2">
          {email ? (
            <>
              You are signed in as <strong>{email}</strong>, and this
              account does not have portal access.
            </>
          ) : (
            'This account does not have portal access.'
          )}
        </p>
        <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed mb-7">
          If you run a shop, your BillDost app is at app.billdost.in. If
          you are on the team, ask the founder to activate your access.
        </p>
        <button
          onClick={signOut}
          className="w-full py-3.5 bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] text-white font-bold text-[15px] rounded-full transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
