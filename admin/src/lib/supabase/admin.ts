import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The service-role client. SERVER ONLY. This key bypasses row level
 * security and can read and write every shop's data, which is exactly
 * why it lives here and nowhere else: never import this file from a
 * client component, never prefix the key with NEXT_PUBLIC.
 *
 * Every use of this client in a route handler happens AFTER the
 * caller's admin session and role have been verified (see lib/auth).
 */
let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (cached) return cached
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  return cached
}
