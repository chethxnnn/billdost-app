import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { requireManagerOrOwner, requireShopAccess } from '../utils/auth'

/**
 * Shop expenses (blueprint D11) on the expenses table from migration
 * 0010 plus the mode/status columns and expense_categories table from
 * 0015. RLS already scopes rows per shop and role (insert: member,
 * update/delete: manager or owner); the router mirrors that so errors
 * are clean instead of raw policy failures. Cancelled expenses stay
 * in the table with status 'cancelled' and are excluded from totals.
 */

export const BUILT_IN_CATEGORIES = [
  'rent',
  'salary',
  'electricity',
  'transport',
  'packaging',
  'tea_food',
  'other',
] as const

const expenseInput = z.object({
  category: z.string().min(1).max(60),
  amount: z.number().positive(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(['cash', 'upi', 'bank']).default('cash'),
  note: z.string().max(500).optional().nullable(),
})

export const expensesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
        includeCancelled: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      let query = supabase
        .from('expenses')
        .select('id, category, amount, expense_date, mode, status, note, created_at')
        .eq('shop_id', shop.id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)

      if (input.month) {
        const [y, m] = input.month.split('-').map(Number)
        const from = `${input.month}-01`
        const next = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0]
        query = query.gte('expense_date', from).lt('expense_date', next)
      }
      if (!input.includeCancelled) query = query.eq('status', 'active')

      const { data, error } = await query
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      const rows = (data || []).map((r: any) => ({ ...r, amount: Number(r.amount) || 0 }))
      const byCategory: Record<string, number> = {}
      let total = 0
      for (const r of rows) {
        if (r.status !== 'active') continue
        byCategory[r.category] = (byCategory[r.category] || 0) + r.amount
        total += r.amount
      }
      return { expenses: rows, total, byCategory }
    }),

  create: protectedProcedure.input(expenseInput).mutation(async ({ ctx, input }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        shop_id: shop.id,
        category: input.category.trim(),
        amount: input.amount,
        expense_date: input.expense_date,
        mode: input.mode,
        note: input.note || null,
        created_by: user.id,
      })
      .select()
      .single()
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return data
  }),

  update: protectedProcedure
    .input(expenseInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { data, error } = await supabase
        .from('expenses')
        .update({
          category: input.category.trim(),
          amount: input.amount,
          expense_date: input.expense_date,
          mode: input.mode,
          note: input.note || null,
        })
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .select()
        .single()
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /** Soft cancel: the row stays for audit, totals exclude it. */
  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { error } = await supabase
        .from('expenses')
        .update({ status: 'cancelled' })
        .eq('id', input.id)
        .eq('shop_id', shop.id)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  listCategories: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)

    const { data, error } = await supabase
      .from('expense_categories')
      .select('id, name')
      .eq('shop_id', shop.id)
      .order('name')
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    const custom = (data || []).map((c: any) => c.name as string)
    const merged = [...BUILT_IN_CATEGORIES, ...custom.filter((n) => !(BUILT_IN_CATEGORIES as readonly string[]).includes(n))]
    return { builtIn: [...BUILT_IN_CATEGORIES], custom, all: merged }
  }),

  addCategory: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { data, error } = await supabase
        .from('expense_categories')
        .insert({ shop_id: shop.id, name: input.name.trim() })
        .select()
        .single()
      if (error) {
        if ((error as any).code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Ye category pehle se hai.' })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }
      return data
    }),
})
