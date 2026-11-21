import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { resolveShopAndRole } from '../utils/auth'

/**
 * Payments history (blueprint D19): the payments ledger across all
 * invoices, newest first, filterable by date range, mode and a text
 * search over invoice number and customer name. Totals are computed
 * from the same rows the list shows. A cashier sees only payments
 * they received themselves; owner and manager see the whole shop.
 */

const filtersInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mode: z.enum(['cash', 'upi', 'bank']).optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(500).default(200),
})

export interface PaymentRow {
  id: string
  amount: number
  mode: string
  note: string | null
  source: string
  created_at: string
  invoice_id: string
  invoice_number: string | null
  customer_name: string | null
  received_by: string
  mine: boolean
}

async function fetchPayments(
  ctx: any,
  input: z.infer<typeof filtersInput>
): Promise<PaymentRow[]> {
  const { supabase, user } = ctx
  const { shop, role } = await resolveShopAndRole(supabase, user.id)

  let query = supabase
    .from('payments')
    .select(
      'id, amount, mode, note, source, created_at, received_by, invoice_id, customer_id, invoices(invoice_number, customer_name), customers(name)'
    )
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })
    .limit(input.limit)

  if (role === 'cashier') query = query.eq('received_by', user.id)
  if (input.from) query = query.gte('created_at', `${input.from}T00:00:00`)
  if (input.to) query = query.lte('created_at', `${input.to}T23:59:59`)
  if (input.mode) query = query.eq('mode', input.mode)

  const { data, error } = await query
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

  let rows: PaymentRow[] = (data || []).map((r: any) => ({
    id: r.id,
    amount: Number(r.amount) || 0,
    mode: r.mode as string,
    note: r.note as string | null,
    source: r.source as string,
    created_at: r.created_at as string,
    invoice_id: r.invoice_id as string,
    invoice_number: r.invoices?.invoice_number || null,
    customer_name: r.customers?.name || r.invoices?.customer_name || null,
    received_by: r.received_by as string,
    mine: r.received_by === user.id,
  }))

  if (input.search) {
    const needle = input.search.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        (r.invoice_number || '').toLowerCase().includes(needle) ||
        (r.customer_name || '').toLowerCase().includes(needle)
    )
  }
  return rows
}

export const paymentsRouter = router({
  list: protectedProcedure.input(filtersInput).query(async ({ ctx, input }) => {
    return fetchPayments(ctx, input)
  }),

  summary: protectedProcedure.input(filtersInput).query(async ({ ctx, input }) => {
    const rows = await fetchPayments(ctx, { ...input, limit: 500 })
    const byMode: Record<string, { count: number; amount: number }> = {}
    let total = 0
    for (const r of rows) {
      byMode[r.mode] = byMode[r.mode] || { count: 0, amount: 0 }
      byMode[r.mode].count += 1
      byMode[r.mode].amount += r.amount
      total += r.amount
    }
    return { total, count: rows.length, byMode }
  }),
})
