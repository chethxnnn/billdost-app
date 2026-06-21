import { appRouter } from '@/server/routers/_app'
import { createCallerFactory } from '@/server/trpc'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const createCaller = createCallerFactory(appRouter)

/**
 * Server-side tRPC caller for use in Server Components and Route Handlers.
 * Does NOT go through the HTTP layer — calls procedures directly in-process.
 *
 * Usage (in a Server Component):
 *   const caller = await createServerCaller()
 *   const data = await caller.analytics.overview()
 */
export async function createServerCaller() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {}, // read-only in Server Components
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return createCaller({ supabase, user })
}
