import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireOwner, requireShopAccess } from '../utils/auth'
import { hashActivationToken } from '@/lib/token-hash'
import { buildJoinLink } from '@/lib/staff-invite'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Mint a fresh staff activation link for an invited row (Stage 4,
 * migration 0025). The raw token is 32 random bytes, base64url; only
 * its SHA-256 hash reaches the database through
 * staff_invite_issue_tx, which also kills any earlier live link for
 * the row. The owner sends the returned link himself (WhatsApp or
 * copy), so no email ever leaves the system for an invite.
 */
async function issueStaffLink(
  supabase: SupabaseClient,
  staffMemberId: string
): Promise<string> {
  const raw = randomBytes(32).toString('base64url')
  const { error } = await supabase.rpc('staff_invite_issue_tx', {
    p_staff_member_id: staffMemberId,
    p_token_hash: hashActivationToken(raw),
  })
  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
  }
  return buildJoinLink(process.env.NEXT_PUBLIC_APP_URL ?? '', raw)
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
      .select('id, user_id, email, name, phone, role, status, created_at')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: true })

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return staff ?? []
  }),

  /**
   * Invite a new staff member (owner only, Stage 4). No invite email
   * is sent any more: the row is created in invited state and the
   * owner gets a one-time activation link to send over WhatsApp or
   * copy. The invitee opens /join/[token], sees the shop name and
   * role, and sets their own password; if their email already has a
   * BillDost account the join page routes them to sign in and the
   * existing accept_staff_invite path attaches the membership.
   *
   * Email and phone are both optional individually, but at least one
   * is required: email becomes the login id, phone is where the
   * owner sends the link. An existing row for the same email (or
   * phone, when no email is given) is re-invited with a fresh link
   * instead of throwing; an already active member with the same role
   * is the only conflict, and it says so.
   */
  invite: protectedProcedure
    .input(z.object({
      email: z.string().email().optional(),
      phone: z.string().trim().min(10).max(15).optional(),
      name: z.string().min(1).optional(),
      role: z.enum(['manager', 'cashier']).default('cashier')
    }).refine((d) => Boolean(d.email || d.phone), {
      message: 'Email ya phone, kam se kam ek chahiye.',
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)
      const email = input.email?.toLowerCase()
      const phone = input.phone?.trim()

      // Existing row for this shop and email (or phone)?
      let existingQuery = supabase
        .from('staff_members')
        .select('id, role, status')
        .eq('shop_id', shop.id)
      existingQuery = email
        ? existingQuery.ilike('email', email)
        : existingQuery.eq('phone', phone!)
      const { data: existingRow } = await existingQuery.maybeSingle()

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
          return { staff: data, link: null as string | null }
        }
        // Re-invite: reset to invited with the (possibly new) role
        // and contact details, then mint a fresh link.
        const { data, error } = await supabase
          .from('staff_members')
          .update({
            role: input.role,
            status: 'invited',
            name: input.name ?? undefined,
            email: email ?? undefined,
            phone: phone ?? undefined,
          })
          .eq('id', existingRow.id)
          .select()
          .single()
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
        const link = await issueStaffLink(supabase, existingRow.id)
        return { staff: data, link }
      }

      const { data, error } = await supabase
        .from('staff_members')
        .insert({
          shop_id: shop.id,
          email: email ?? null,
          phone: phone ?? null,
          name: input.name,
          role: input.role,
          status: 'invited',
          invited_by: user.id,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') throw new TRPCError({ code: 'CONFLICT', message: 'Staff with this email already exists' })
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      const link = await issueStaffLink(supabase, data.id)

      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'staff_invited',
        entity_type: 'staff',
        entity_id: data.id,
        summary: `${input.name || email || phone} ko ${input.role} invite link banaya`,
      })

      return { staff: data, link }
    }),

  /**
   * Resend the invite link (owner only): a disabled row first comes
   * back to invited, then a fresh token is minted, which kills the
   * previous link for that row. Returns the new link for the owner
   * to send again.
   */
  resendInvite: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)

      const { data: target } = await supabase
        .from('staff_members')
        .select('id, status, role')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Staff member not found' })
      if (target.role === 'owner') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Owner ke liye invite link nahi banta.' })
      }
      if (target.status === 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ye member pehle se active hai.' })
      }
      if (target.status === 'disabled') {
        const { error } = await supabase
          .from('staff_members')
          .update({ status: 'invited' })
          .eq('id', target.id)
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      const link = await issueStaffLink(supabase, target.id)
      return { link }
    }),

  /**
   * Invites addressed to the signed-in user (blueprint C4): invited
   * rows linked to me, or carrying my email. Link-based invites
   * (Stage 4) leave user_id null until the invitee joins, so the
   * email match is what surfaces them for existing account holders;
   * accept_staff_invite matches the same way. The dashboard can
   * surface a "You have been invited to <shop>" card from this.
   */
  myInvites: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx

    const { data, error } = await supabase
      .from('staff_members')
      .select('id, shop_id, role, status, created_at, shops ( name )')
      .eq('status', 'invited')
      .or(`user_id.eq.${user.id},email.ilike.${user.email ?? ''}`)
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
