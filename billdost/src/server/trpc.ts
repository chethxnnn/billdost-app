import { initTRPC, TRPCError } from '@trpc/server'
import { type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * 1. CONTEXT
 *    Built once per request. Passes the authed Supabase user + shop into every tRPC procedure.
 */
export async function createTRPCContext(opts: { req: NextRequest }) {
  const { req } = opts

  // Build a Supabase client that can read/set cookies from the incoming request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        // tRPC context is read-only — cookie setting is handled by middleware
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabase, user }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

/**
 * 2. INITIALISE tRPC
 */
const t = initTRPC.context<TRPCContext>().create()

/**
 * 3. REUSABLE EXPORTS
 */
export const router = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure

/**
 * Protected procedure — throws UNAUTHORIZED if no session exists.
 * Use this for every route that requires a logged-in user.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Login required' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})
