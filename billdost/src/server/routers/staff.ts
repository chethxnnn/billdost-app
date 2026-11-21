import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireOwner, requireShopAccess } from '../utils/auth'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Finds an existing Supabase auth user by email, or null. */
async function findAuthUserByEmail(email: string) {
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return null
  return data.users.find((u) => u.email?.toLowerCase() === email) ?? null
}

export const staffRouter = router({
  /**
   * List all staff members for the shop, every status included so the
   * UI can show pending invites, active members and disabled members
   * distinctly. Accessible by any staff member.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)

    const { data: staff, error } = await supabase
      .from('staff_members')
      .select('id, user_id, email, name, role, status, created_at')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: true })

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return staff ?? []
  }),

  /**
   * Invite a new staff member (owner only, blueprint C4).
   * Three cases, none of them a dead end:
   * 1. The email already has a BillDost account: no invite email is
   *    sent (inviteUserByEmail would fail); the row is linked to that
   *    user as invited and activates on their next login through
   *    accept_staff_invite, or in-app through staff.acceptInvite.
   * 2. A row already exists for this shop and email: re-invite resets
   *    it to invited with the new role instead of throwing CONFLICT.
   *    An already active member with the same role is the only
   *    conflict, and it says so.
   * 3. A brand-new email: Supabase sends the invite, landing on
   *    /auth/callback, which activates the row before anything else.
   */
  invite: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1).optional(),
      role: z.enum(['manager', 'cashier']).default('cashier')
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)
      const email = input.email.toLowerCase()

      // Existing row for this shop and email?
      const { data: existingRow } = await supabase
        .from('staff_members')
        .select('id, role, status')
        .eq('shop_id', shop.id)
        .ilike('email', email)
        .single()

      if (existingRow) {
        if (existingRow.status === 'active') {
          if (existingRow.role === input.role) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Ye member pehle se aapki team mein active hai.' })
          }
          const { data, error } = await supabase
            .from('staff_members')
            .update({ role: input.role })
            .eq('id', existingRow.id)
            .select()
            .single()
          if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
          return data
        }
        // Re-invite: reset to invited with the (possibly new) role.
        const { data, error } = await supabase
          .from('staff_members')
          .update({ role: input.role, status: 'invited', name: input.name ?? undefined })
          .eq('id', existingRow.id)
          .select()
          .single()
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
        return data
      }

      // Existing BillDost account under this email?
      const existingUser = await findAuthUserByEmail(email)
      if (existingUser) {
        const { data, error } = await supabase
          .from('staff_members')
          .insert({
            shop_id: shop.id,
            email,
            name: input.name,
            role: input.role,
            status: 'invited',
            user_id: existingUser.id,
          })
          .select()
          .single()
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

        await supabase.from('activity_log').insert({
          shop_id: shop.id,
          type: 'staff_invited',
          entity_type: 'staff',
          entity_id: data.id,
          summary: `${input.name || email} ko ${input.role} invite bheja (existing account)`,
        })
        return data
      }

      // Brand-new email: Supabase sends the invite.
      const admin = adminClient()
      const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          data: { name: input.name },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || ''}/auth/callback`,
        }
      )

      if (authError || !authData.user) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to send email: ${authError?.message}` })
      }

      const { data, error } = await supabase
        .from('staff_members')
        .insert({
          shop_id: shop.id,
          email,
          name: input.name,
          role: input.role,
          status: 'invited',
          user_id: authData.user.id,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') throw new TRPCError({ code: 'CONFLICT', message: 'Staff with this email already exists' })
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'staff_invited',
        entity_type: 'staff',
        entity_id: data.id,
        summary: `${input.name || email} ko ${input.role} invite bheja`,
      })

      return data
    }),

  /**
   * Invites addressed to the signed-in user (blueprint C4): rows where
   * user_id is me and status is invited. The dashboard can surface a
   * "You have been invited to <shop>" card from this.
   */
  myInvites: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx

    const { data, error } = await supabase
      .from('staff_members')
      .select('id, shop_id, role, status, created_at, shops ( name )')
      .eq('user_id', user.id)
      .eq('status', 'invited')
      .order('created_at', { ascending: false })

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return data ?? []
  }),

  /**
   * In-app accept: wraps the accept_staff_invite RPC for a user who is
   * already logged in. Returns the shop id that was activated, or null
   * when there was no pending invite.
   */
  acceptInvite: protectedProcedure.mutation(async ({ ctx }) => {
    const { supabase } = ctx
    const { data, error } = await supabase.rpc('accept_staff_invite')
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return { shop_id: (data as string | null) ?? null }
  }),

  /**
   * Update a staff member's role (owner only). The owner's own row
   * cannot be demoted through this path.
   */
  updateRole: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      role: z.enum(['manager', 'cashier'])
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)

      const { data: target } = await supabase
        .from('staff_members')
        .select('role')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Staff member not found' })
      if (target.role === 'owner') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Owner ka role change nahi ho sakta.' })
      }

      const { data, error } = await supabase
        .from('staff_members')
        .update({ role: input.role })
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /**
   * Remove a staff member (owner only): a soft removal. The row is
   * disabled, keeping user_id for audit, and resolveShopAndRole
   * rejects non-active members on their very next request.
   */
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)

      const { data: target } = await supabase
        .from('staff_members')
        .select('role')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Staff member not found' })
      if (target.role === 'owner') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Owner ko remove nahi kar sakte.' })
      }

      const { error } = await supabase
        .from('staff_members')
        .update({ status: 'disabled' })
        .eq('id', input.id)
        .eq('shop_id', shop.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  /**
   * Reactivate a disabled or invited member (owner only): members who
   * already have an account go straight back to active; members who
   * never accepted return to invited.
   */
  reactivate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)

      const { data: target } = await supabase
        .from('staff_members')
        .select('user_id, status')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Staff member not found' })

      const { data, error } = await supabase
        .from('staff_members')
        .update({ status: target.user_id ? 'active' : 'invited' })
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    })
})
