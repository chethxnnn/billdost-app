import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireShopAccess, requireManagerOrOwner } from '../utils/auth'
import { mapRpcError } from '../utils/rpcErrors'

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
  barcode:         z.string().max(50).optional().nullable(),
  sku:             z.string().max(50).optional().nullable(),
  track_expiry:    z.boolean().default(false),
  is_active:       z.boolean().default(true),
})

/**
 * Barcode uniqueness is per shop (partial unique index in migration
 * 0004). Checked in the router first so the shopkeeper gets a friendly
 * message naming the product that already owns the code, with the
 * index as the backstop against races.
 */
async function assertBarcodeFree(
  supabase: any,
  shopId: string,
  barcode: string | null | undefined,
  excludeId?: string
) {
  const code = barcode?.trim()
  if (!code) return
  let query = supabase
    .from('products')
    .select('id, name')
    .eq('shop_id', shopId)
    .eq('barcode', code)
  if (excludeId) query = query.neq('id', excludeId)
  const { data: existing } = await query.limit(1).single()
  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Ye barcode pehle se "${existing.name}" par laga hai.`,
    })
  }
}

export const productsRouter = router({
  /* ─────────────────────────────────────────
     LIST  - all products for the shop
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
     GET CATEGORIES - distinct category list
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

      await assertBarcodeFree(supabase, shop.id, input.barcode)

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

      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Ye barcode ya SKU pehle se kisi product par laga hai.' })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

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

      await assertBarcodeFree(supabase, shop.id, fields.barcode, id)

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
     HARD DELETE - permanent removal
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
     UPDATE STOCK - sets an absolute quantity via adjust_stock_tx,
     which locks the product row, writes the new quantity and the
     inventory ledger row in one transaction (blueprint B.6). The
     input qty is the NEW total, as the StockAdjustModal computes it.
  ───────────────────────────────────────── */
  updateStock: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      qty: z.number().min(0),
      notes: z.string().optional(),
      type: z.enum(['STOCK_IN', 'STOCK_OUT', 'AUDIT']).default('AUDIT')
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { error } = await supabase.rpc('adjust_stock_tx', {
        p_product_id: input.id,
        p_new_qty: input.qty,
        p_type: input.type,
        p_note: input.notes || 'Manual adjustment via dashboard',
        p_actor: user.id,
      })

      if (error) throw mapRpcError(error)

      const { data, error: fetchErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (fetchErr || !data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' })
      return data
    }),

  /* ─────────────────────────────────────────
     GET BY BARCODE (blueprint D2): exact match, shop-scoped. Used by
     scan-to-add in billing and by the catalog scan lookup. Returns
     null (not an error) for an unknown code so the UI can offer
     "create product with this barcode" inline.
  ───────────────────────────────────────── */
  getByBarcode: protectedProcedure
    .input(z.object({ barcode: z.string().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('barcode', input.barcode.trim())
        .eq('is_active', true)
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
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
     LOW STOCK - items below alert threshold
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

  // ---------------------------------------------------------- batches
  // Batch and expiry management (blueprint D5). Stock changes go
  // through the migration 0015 RPCs so product stock, batch qty and
  // the inventory log move together; plain reads are direct selects.
  // FEFO deduction at billing time is NOT wired yet: see
  // docs/fefo-batch-allocation.md for the exact Stage 5 change.

  listBatches: protectedProcedure
    .input(z.object({ product_id: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      let query = supabase
        .from('product_batches')
        .select('id, product_id, batch_no, expiry_date, mfg_date, qty, cost_price, mrp, created_at, products(name)')
        .eq('shop_id', shop.id)
        .order('expiry_date', { ascending: true, nullsFirst: false })
      if (input?.product_id) query = query.eq('product_id', input.product_id)

      const { data, error } = await query
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return (data || []).map((b: any) => ({
        id: b.id,
        product_id: b.product_id,
        product_name: b.products?.name || null,
        batch_no: b.batch_no,
        expiry_date: b.expiry_date,
        mfg_date: b.mfg_date,
        qty: Number(b.qty) || 0,
        cost_price: b.cost_price === null ? null : Number(b.cost_price),
        mrp: b.mrp === null ? null : Number(b.mrp),
        created_at: b.created_at,
      }))
    }),

  expiringSoon: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    const { data, error } = await supabase
      .from('product_batches')
      .select('id, product_id, batch_no, expiry_date, qty, products(name)')
      .eq('shop_id', shop.id)
      .gt('qty', 0)
      .not('expiry_date', 'is', null)
      .order('expiry_date', { ascending: true })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rows = (data || []).map((b: any) => {
      const expiry = new Date(`${b.expiry_date}T00:00:00`)
      const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000)
      return {
        id: b.id,
        product_id: b.product_id,
        product_name: b.products?.name || null,
        batch_no: b.batch_no,
        expiry_date: b.expiry_date,
        qty: Number(b.qty) || 0,
        days_left: daysLeft,
      }
    })
    return {
      expired: rows.filter((r) => r.days_left < 0),
      within7: rows.filter((r) => r.days_left >= 0 && r.days_left <= 7),
      within30: rows.filter((r) => r.days_left > 7 && r.days_left <= 30),
    }
  }),

  addBatch: protectedProcedure
    .input(
      z.object({
        product_id: z.string().uuid(),
        batch_no: z.string().min(1).max(60),
        expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        mrp: z.number().min(0).optional().nullable(),
        cost_price: z.number().min(0).optional().nullable(),
        qty: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      await requireManagerOrOwner(supabase, user.id)

      const { data, error } = await supabase.rpc('add_product_batch_tx', {
        p_product_id: input.product_id,
        p_batch_no: input.batch_no,
        p_expiry_date: input.expiry_date || null,
        p_mrp: input.mrp ?? null,
        p_cost_price: input.cost_price ?? null,
        p_qty: input.qty,
        p_actor: user.id,
      })
      if (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Batch add nahi ho paya.',
        })
      }
      return { batch_id: data as string }
    }),

  writeOffBatch: protectedProcedure
    .input(z.object({ batch_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      await requireManagerOrOwner(supabase, user.id)

      const { error } = await supabase.rpc('write_off_batch_tx', {
        p_batch_id: input.batch_id,
        p_actor: user.id,
      })
      if (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Batch write-off nahi ho paya.',
        })
      }
      return { success: true }
    }),
})
