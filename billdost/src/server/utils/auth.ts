import { TRPCError } from '@trpc/server'

/**
 * Core function to resolve shop and role.
 */
export async function resolveShopAndRole(supabase: any, userId: string) {
  const { data: shopAsOwner } = await supabase
    .from('shops')
    .select('id, name, invoice_prefix, invoice_counter, state, owner_id, onboarding_done')
    .eq('owner_id', userId)
    .single()

  if (shopAsOwner) return { shop: shopAsOwner, role: 'owner' as const }

  const { data: staffMember } = await supabase
    .from('staff_members')
    .select('role, status, shop_id')
    .eq('user_id', userId)
    .single()

  if (!staffMember || staffMember.status !== 'active') {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have access to any shop.' })
  }

  const { data: shopAsStaff } = await supabase
    .from('shops')
    .select('id, name, invoice_prefix, invoice_counter, state, owner_id, onboarding_done')
    .eq('id', staffMember.shop_id)
    .single()

  if (!shopAsStaff) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shop not found.' })

  return { shop: shopAsStaff, role: staffMember.role as 'manager' | 'cashier' }
}

/**
 * Returns shop for ANY valid role (owner, manager, cashier).
 */
export async function requireShopAccess(supabase: any, userId: string) {
  const { shop } = await resolveShopAndRole(supabase, userId)
  return shop
}

/**
 * Returns shop ONLY if user is owner or manager. Throws FORBIDDEN for cashier.
 */
export async function requireManagerOrOwner(supabase: any, userId: string) {
  const { shop, role } = await resolveShopAndRole(supabase, userId)
  if (role === 'cashier') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cashiers do not have permission for this action.' })
  }
  return shop
}

/**
 * Returns shop ONLY if user is owner.
 */
export async function requireOwner(supabase: any, userId: string) {
  const { shop, role } = await resolveShopAndRole(supabase, userId)
  if (role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the shop owner can perform this action.' })
  }
  return shop
}
