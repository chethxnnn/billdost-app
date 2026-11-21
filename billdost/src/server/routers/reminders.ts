import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { requireShopAccess } from '../utils/auth'

/**
 * Udhaar book and payment reminders (blueprint D7).
 *
 * Outstanding per customer is always derived from stored truth:
 * customers.opening_balance plus the balance_due of that customer's
 * non-cancelled invoices (the payments ledger keeps balance_due
 * correct). Payments against udhaar go through the
 * record_udhaar_payment_tx RPC (migration 0015), which allocates
 * oldest-first through the same record_payment_tx the invoice screen
 * uses. Reminder sends live in the whatsapp router; this router owns
 * the book, the pause flag and the reminder log reads.
 */
export const remindersRouter = router({
  listDue: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)
    const shopId = shop.id

    const [{ data: customers, error: custErr }, { data: openInvoices, error: invErr }] =
      await Promise.all([
        supabase
          .from('customers')
          .select('id, name, phone, opening_balance, reminders_paused')
          .eq('shop_id', shopId),
        supabase
          .from('invoices')
          .select('id, customer_id, balance_due, invoice_date')
          .eq('shop_id', shopId)
          .gt('balance_due', 0)
          .neq('status', 'cancelled'),
      ])
    if (custErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: custErr.message })
    if (invErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: invErr.message })

    interface Acc {
      due: number
      bill_count: number
      oldest: string | null
    }
    const byCustomer = new Map<string, Acc>()
    let unattributedTotal = 0
    for (const inv of openInvoices || []) {
      const due = Number(inv.balance_due) || 0
      if (!inv.customer_id) {
        // Walk-in bills carry no customer id; their due cannot be
        // chased per customer, so it is reported separately and
        // honestly instead of being silently dropped.
        unattributedTotal += due
        continue
      }
      const acc = byCustomer.get(inv.customer_id) || { due: 0, bill_count: 0, oldest: null }
      acc.due += due
      acc.bill_count += 1
      if (!acc.oldest || inv.invoice_date < acc.oldest) acc.oldest = inv.invoice_date
      byCustomer.set(inv.customer_id, acc)
    }

    const entries = (customers || [])
      .map((c) => {
        const acc = byCustomer.get(c.id)
        const opening = Number(c.opening_balance) || 0
        return {
          customer_id: c.id,
          customer_name: c.name,
          customer_phone: c.phone,
          outstanding: opening + (acc?.due || 0),
          opening_balance: opening,
          bill_count: acc?.bill_count || 0,
          oldest_unpaid_date: acc?.oldest || null,
          reminders_paused: Boolean(c.reminders_paused),
        }
      })
      .filter((e) => e.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)

    return {
      entries,
      unattributed_total: unattributedTotal,
      total: entries.reduce((s, e) => s + e.outstanding, 0),
    }
  }),

  recordUdhaarPayment: protectedProcedure
    .input(
      z.object({
        customer_id: z.string().uuid(),
        amount: z.number().positive(),
        mode: z.enum(['cash', 'upi', 'bank']),
        note: z.string().max(500).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)
    const shopId = shop.id

      const { data, error } = await supabase.rpc('record_udhaar_payment_tx', {
        p_shop_id: shopId,
        p_actor: user.id,
        p_payload: {
          customer_id: input.customer_id,
          amount: input.amount,
          mode: input.mode,
          note: input.note || null,
        },
      })
      if (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Payment record nahi ho paya.',
        })
      }
      const result = (data || {}) as { allocated?: number; unallocated?: number }
      return {
        allocated: Number(result.allocated) || 0,
        unallocated: Number(result.unallocated) || 0,
      }
    }),

  setPaused: protectedProcedure
    .input(z.object({ customer_id: z.string().uuid(), paused: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)
    const shopId = shop.id

      const { error } = await supabase
        .from('customers')
        .update({ reminders_paused: input.paused })
        .eq('id', input.customer_id)
        .eq('shop_id', shopId)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  listLog: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)
    const shopId = shop.id

    const { data, error } = await supabase
      .from('reminder_log')
      .select('id, customer_id, amount_due, channel, status, created_at, customers(name)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    return (data || []).map((row: any) => ({
      id: row.id,
      customer_id: row.customer_id,
      customer_name: row.customers?.name || null,
      amount_due: Number(row.amount_due) || 0,
      channel: row.channel,
      status: row.status,
      created_at: row.created_at,
    }))
  }),
})
