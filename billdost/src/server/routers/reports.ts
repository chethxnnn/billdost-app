import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireManagerOrOwner } from '../utils/auth'

export const reportsRouter = router({
  /**
   * getGstSummary — Returns CGST, SGST, IGST totals for a given date range
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
})
