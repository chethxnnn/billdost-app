import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'

/**
 * tRPC React client.
 * Import `trpc` anywhere in Client Components to call procedures.
 *
 * Usage:
 *   const { data } = trpc.analytics.overview.useQuery()
 */
export const trpc = createTRPCReact<AppRouter>()
