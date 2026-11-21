import { z } from 'zod'
import { createHash, randomBytes } from 'crypto'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireManagerOrOwner } from '../utils/auth'
import { buildGstr1 } from '@/lib/gstr1'
import { fetchGstRangeData, monthRange } from '../gstr1Data'

export const reportsRouter = router({
  /**
   * getGstSummary: returns CGST, SGST, IGST totals for a given date range
   */
  getGstSummary: protectedProcedure
    .input(z.object({
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string(),   // YYYY-MM-DD
    }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx

      const shop = await requireManagerOrOwner(supabase, user.id)

      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_date, invoice_number, customer_name, total, taxable_amt, cgst_amt, sgst_amt, igst_amt, payment_status')
        .eq('shop_id', shop.id)
        .gte('invoice_date', input.startDate)
        .lte('invoice_date', input.endDate)
        .order('invoice_date', { ascending: false })

      const summary = {
        totalRevenue: 0,
        totalTaxable: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
      }

      ;(invoices ?? []).forEach(inv => {
        summary.totalRevenue += Number(inv.total || 0)
        summary.totalTaxable += Number(inv.taxable_amt || 0)
        summary.totalCgst += Number(inv.cgst_amt || 0)
        summary.totalSgst += Number(inv.sgst_amt || 0)
        summary.totalIgst += Number(inv.igst_amt || 0)
      })

      return {
        summary,
        invoices: invoices ?? []
      }
    }),

  /**
   * getGstr1: the full GSTR-1 document for one month (blueprint D9),
   * built by the pure builder in src/lib/gstr1.ts from stored rows.
   * The same document is what the JSON download returns.
   */
  getGstr1: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)
      const { from, to, fp } = monthRange(input.month)

      const data = await fetchGstRangeData(supabase, shop.id, from, to)
      return buildGstr1({
        shop_gstin: shop.gstin || null,
        shop_state_code: (shop as any).state_code || null,
        fp,
        invoices: data.gstr1Invoices,
        credit_notes: data.creditNotes,
      })
    }),

  /**
   * CA share links (blueprint D9): a read-only, time-boxed public
   * page at /ca/<token>. Only the sha256 hash is stored; the raw
   * token is returned exactly once, here, at creation.
   */
  createShareLink: protectedProcedure
    .input(
      z.object({
        label: z.string().max(80).optional().nullable(),
        period_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        period_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        days: z.number().int().min(1).max(90).default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const token = randomBytes(32).toString('base64url')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + input.days * 86_400_000)

      const { data, error } = await supabase
        .from('ca_share_links')
        .insert({
          shop_id: shop.id,
          token_hash: tokenHash,
          label: input.label || null,
          period_from: input.period_from,
          period_to: input.period_to,
          expires_at: expiresAt.toISOString(),
          created_by: user.id,
        })
        .select('id, expires_at')
        .single()
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      return {
        id: data.id,
        token,
        path: `/ca/${token}`,
        expires_at: data.expires_at,
      }
    }),

  listShareLinks: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    const { data, error } = await supabase
      .from('ca_share_links')
      .select('id, label, period_from, period_to, expires_at, revoked_at, created_at')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    const now = Date.now()
    return (data || []).map((row: any) => ({
      ...row,
      state: row.revoked_at
        ? 'revoked'
        : row.expires_at && new Date(row.expires_at).getTime() < now
          ? 'expired'
          : 'active',
    }))
  }),

  revokeShareLink: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { error } = await supabase
        .from('ca_share_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('shop_id', shop.id)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),
})
