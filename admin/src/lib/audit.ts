import { createAdminClient } from '@/lib/supabase/admin'
import type { AdminProfile } from '@/lib/auth'

/**
 * Every mutating admin action writes one row to admin_audit_log
 * (Admin Portal plan, Section 12: there is no admin action without a
 * record). RPC-driven actions (shop created, activation issued,
 * shop activated) write their own rows inside the database
 * transaction; this helper covers everything the portal does with
 * direct table writes. A failed audit write is logged to the server
 * console but never silently swallowed into a fake success: callers
 * that cannot afford to lose the record should treat a throw here as
 * a failed action.
 */
export async function writeAudit(
  admin: AdminProfile | null,
  action: string,
  opts: {
    shopId?: string | null
    requestId?: string | null
    details?: Record<string, unknown>
  } = {}
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_user_id: admin?.id ?? null,
    action,
    shop_id: opts.shopId ?? null,
    request_id: opts.requestId ?? null,
    details: opts.details ?? {},
  })
  if (error) {
    console.error('admin_audit_log write failed', { action, error: error.message })
    throw new Error('audit_write_failed')
  }
}
