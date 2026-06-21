import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireOwner, requireShopAccess } from '../utils/auth'
import { createClient } from '@supabase/supabase-js'

export const staffRouter = router({
  /**
   * List all staff members for the shop
   * Accessible by any staff member (so cashiers can see who else is on shift, or managers can view team)
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
   * Invite a new staff member
   * Only accessible by Owner
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

      // Initialize Supabase Admin client to send invite email
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // 1. Send the actual email invite via Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        input.email.toLowerCase(),
        {
          data: { name: input.name }
        }
      )

      if (authError) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to send email: ${authError.message}` })
      }

      // 2. Insert into staff_members table
      const { data, error } = await supabase
        .from('staff_members')
        .insert({
          shop_id: shop.id,
          email: input.email.toLowerCase(),
          name: input.name,
          role: input.role,
          status: 'invited',
          user_id: authData.user?.id // Link user ID immediately since admin API created the auth record
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') throw new TRPCError({ code: 'CONFLICT', message: 'Staff with this email already exists' })
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return data
    }),

  /**
   * Update a staff member's role
   * Only accessible by Owner
   */
  updateRole: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      role: z.enum(['manager', 'cashier'])
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)

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
   * Remove a staff member
   * Only accessible by Owner
   */
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)

      const { error } = await supabase
        .from('staff_members')
        .delete()
        .eq('id', input.id)
        .eq('shop_id', shop.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    })
})
