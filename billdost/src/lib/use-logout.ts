'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * One logout path for every surface (sidebar, topbar menu, settings).
 * Uses the existing POST /auth/signout route (clears the SSR session
 * cookies server-side) and also clears the browser client session, so
 * a shared shop device is genuinely signed out.
 */
export function useLogout() {
  const router = useRouter()

  return async () => {
    try {
      await fetch('/auth/signout', { method: 'POST' })
    } catch {
      // Server route unreachable: still clear the local session below.
    }
    try {
      await createClient().auth.signOut()
    } catch {
      // Already signed out server-side.
    }
    router.push('/login')
    router.refresh()
  }
}
