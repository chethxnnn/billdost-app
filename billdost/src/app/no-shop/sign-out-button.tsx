'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={signOut}
      className="px-6 py-3.5 bg-transparent border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[15px] transition-all duration-300"
    >
      Sign out
    </button>
  )
}
