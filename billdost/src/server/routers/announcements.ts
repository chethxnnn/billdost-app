import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { requireShopAccess } from '../utils/auth'

/**
 * Platform announcements, the receiving half (fix round, Stage 2).
 *
 * The admin portal writes announcements (migration 0020); until now
 * the shop app never read them. Visibility and targeting are enforced
 * by RLS (migration 0023): the caller's client only ever sees
 * announcements inside their window and aimed at everyone, the
 * shop's category, or the shop itself. Seen state is per shop in
 * announcement_reads: one person's dismissal clears it for the shop.
 */
export const announcementsRouter = router({
  /** Visible announcements for this shop, newest first, with seen flags. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)
    const shopId = shop.id

    const [{ data: rows, error }, { data: reads, error: readErr }] =
      await Promise.all([
        supabase
          .from('announcements')
          .select('id, title, body, audience, created_at, ends_at')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('shop_id', shopId),
      ])
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    if (readErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: readErr.message })

    const seen = new Set((reads ?? []).map((r) => r.announcement_id as string))
    return (rows ?? []).map((a) => ({
      id: a.id as string,
      title: a.title as string,
      body: a.body as string,
      audience: a.audience as string,
      created_at: a.created_at as string,
      ends_at: (a.ends_at as string | null) ?? null,
      seen: seen.has(a.id as string),
    }))
  }),

  /** How many visible announcements this shop has not seen yet. */
  unseenCount: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)
    const shopId = shop.id

    const [{ data: rows, error }, { data: reads, error: readErr }] =
      await Promise.all([
        supabase.from('announcements').select('id').limit(200),
        supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('shop_id', shopId),
      ])
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    if (readErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: readErr.message })

    const seen = new Set((reads ?? []).map((r) => r.announcement_id as string))
    return (rows ?? []).filter((a) => !seen.has(a.id as string)).length
  }),

  /**
   * Mark announcements seen for this shop. With no ids, marks every
   * currently visible announcement (the notifications page opening).
   * Inserts are idempotent: the (announcement, shop) primary key plus
   * ignoreDuplicates makes a repeat call a no-op.
   */
  markSeen: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)
      const shopId = shop.id

      let ids = input?.ids
      if (!ids || ids.length === 0) {
        const { data: rows, error } = await supabase
          .from('announcements')
          .select('id')
          .limit(200)
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
        ids = (rows ?? []).map((a) => a.id as string)
      }
      if (ids.length === 0) return { marked: 0 }

      const { error } = await supabase
        .from('announcement_reads')
        .upsert(
          ids.map((id) => ({ announcement_id: id, shop_id: shopId })),
          { onConflict: 'announcement_id,shop_id', ignoreDuplicates: true }
        )
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { marked: ids.length }
    }),
})
