import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireShopAccess, requireManagerOrOwner } from '../utils/auth'

/* ─── Shared schema ─── */
const productInput = z.object({
  name:            z.string().min(1, 'Name required').max(100),
  description:     z.string().max(300).optional().nullable(),
  category:        z.string().max(50).optional().nullable(),
  hsn_code:        z.string().max(20).optional().nullable(),
  unit:            z.enum(['piece', 'kg', 'g', 'litre', 'ml', 'dozen', 'pack', 'service', 'hour']).default('piece'),
  price:           z.number().min(0, 'Price must be >= 0'),
  cost_price:      z.number().min(0).optional().nullable(),
  tax_rate:        z.number().min(0).max(100).default(0),
  stock_qty:       z.number().min(0).optional().nullable(),
  low_stock_alert: z.number().min(0).optional().nullable(),
  is_active:       z.boolean().default(true),
})

export const productsRouter = router({
  /* ─────────────────────────────────────────
     LIST  — all products for the shop
     Supports optional ?search and ?category
  ───────────────────────────────────────── */
  list: protectedProcedure
    .input(
      z.object({
        search:   z.string().optional(),
        category: z.string().optional(), // 'all' or specific
        active:   z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      let query = supabase
        .from('products')
        .select('*')
        .eq('shop_id', shop.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (input?.active !== undefined) {
        query = query.eq('is_active', input.active)
      }

      if (input?.category && input.category !== 'all') {
        query = query.ilike('category', input.category)
      }

      if (input?.search && input.search.trim()) {
        query = query.ilike('name', `%${input.search.trim()}%`)
      }

      const { data, error } = await query

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data ?? []
    }),

  /* ─────────────────────────────────────────
     GET CATEGORIES — distinct category list
  ───────────────────────────────────────── */
  categories: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)

    const { data } = await supabase
      .from('products')
      .select('category')
      .eq('shop_id', shop.id)
      .not('category', 'is', null)

    const unique = [...new Set((data ?? []).map((p: any) => p.category).filter(Boolean))]
    return unique as string[]
  }),

  /* ─────────────────────────────────────────
     CREATE
  ───────────────────────────────────────── */
  create: protectedProcedure
    .input(productInput)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      // Get current max sort_order
      const { data: last } = await supabase
        .from('products')
        .select('sort_order')
        .eq('shop_id', shop.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      const nextOrder = (last?.sort_order ?? -1) + 1

      const { data, error } = await supabase
        .from('products')
        .insert({ ...input, shop_id: shop.id, sort_order: nextOrder })
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      // Log activity
      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'product_added',
        entity_type: 'product',
        entity_id: data.id,
        summary: `"${input.name}" catalog mein add hua ₹${input.price}`,
      })

      return data
    }),

  /* ─────────────────────────────────────────
     CREATE MANY (Bulk Import)
  ───────────────────────────────────────── */
  createMany: protectedProcedure
    .input(z.array(productInput))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      if (input.length === 0) return { imported: 0 }

      // Get current max sort_order
      const { data: last } = await supabase
        .from('products')
        .select('sort_order')
        .eq('shop_id', shop.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      let nextOrder = (last?.sort_order ?? -1) + 1

      const validProducts = input.map((p) => {
        const product = { ...p, shop_id: shop.id, sort_order: nextOrder }
        nextOrder++
        return product
      })

      const { data, error } = await supabase
        .from('products')
        .insert(validProducts)
        .select('id')

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'bulk_import',
        entity_type: 'shop',
        entity_id: shop.id,
        summary: `${validProducts.length} items catalog mein bulk add kiye gaye.`,
      })

      return { imported: validProducts.length }
    }),

  /* ─────────────────────────────────────────
     UPDATE
  ───────────────────────────────────────── */
  update: protectedProcedure
    .input(productInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)
      const { id, ...fields } = input

      const { data, error } = await supabase
        .from('products')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('shop_id', shop.id) // ensure ownership
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /* ─────────────────────────────────────────
     DELETE (soft: set is_active = false)
  ───────────────────────────────────────── */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { error } = await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('shop_id', shop.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  /* ─────────────────────────────────────────
     HARD DELETE — permanent removal
  ───────────────────────────────────────── */
  hardDelete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', input.id)
        .eq('shop_id', shop.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  /* ─────────────────────────────────────────
     UPDATE STOCK — adjust stock quantity and log it
  ───────────────────────────────────────── */
  updateStock: protectedProcedure
    .input(z.object({ 
      id: z.string().uuid(), 
      qty: z.number(),
      notes: z.string().optional(),
      type: z.enum(['STOCK_IN', 'STOCK_OUT', 'AUDIT']).default('AUDIT')
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      // Get current stock first
      const { data: currentProduct, error: fetchErr } = await supabase
        .from('products')
        .select('stock_qty')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (fetchErr) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' })

      const prevStock = currentProduct.stock_qty || 0
      const newStock = input.qty
      const change = newStock - prevStock

      // Update stock
      const { data, error } = await supabase
        .from('products')
        .update({ stock_qty: newStock, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      // Write to inventory ledger
      if (change !== 0) {
        await supabase.from('inventory_logs').insert({
          shop_id: shop.id,
          product_id: input.id,
          type: input.type,
          quantity_change: change,
          previous_stock: prevStock,
          new_stock: newStock,
          notes: input.notes || 'Manual adjustment via dashboard',
          created_by: user.id
        })
      }

      return data
    }),

  /* ─────────────────────────────────────────
     GET INVENTORY LOGS (History)
  ───────────────────────────────────────── */
  inventoryLogs: protectedProcedure
    .input(z.object({ product_id: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      let query = supabase
        .from('inventory_logs')
        .select(`
          *,
          products ( name, unit )
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (input.product_id) {
        query = query.eq('product_id', input.product_id)
      }

      const { data, error } = await query
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /* ─────────────────────────────────────────
     MONTHLY INVENTORY REPORT
  ───────────────────────────────────────── */
  monthlyReport: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number() })) // month is 1-12
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      const startDate = new Date(input.year, input.month - 1, 1).toISOString()
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59).toISOString()

      // Fetch logs for the month
      const { data, error } = await supabase
        .from('inventory_logs')
        .select(`
          *,
          products ( name, unit )
        `)
        .eq('shop_id', shop.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /* ─────────────────────────────────────────
     LOW STOCK — items below alert threshold
  ───────────────────────────────────────── */
  lowStock: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .not('low_stock_alert', 'is', null)
      .not('stock_qty', 'is', null)

    // filter where stock_qty <= low_stock_alert
    return (data ?? []).filter(
      (p: any) => Number(p.stock_qty) <= Number(p.low_stock_alert)
    )
  }),
})
