import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireShopAccess } from '../utils/auth'

/* ─── Helper ─── */
async function getShop(supabase: any, userId: string) {
  return await requireShopAccess(supabase, userId)
}

async function getNextQuotationCounter(supabase: any, shopId: string, baseCounter: number) {
  const { data } = await supabase
    .from('quotations')
    .select('quotation_number')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(1)

  let maxCounter = baseCounter
  if (data && data.length > 0) {
    const match = data[0].quotation_number.match(/\d+$/)
    if (match) {
      const num = parseInt(match[0], 10)
      if (!isNaN(num) && num > maxCounter) {
        maxCounter = num
      }
    }
  }
  return maxCounter + 1
}

async function getNextInvoiceCounter(supabase: any, shopId: string, baseCounter: number) {
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(1)

  let maxCounter = baseCounter
  if (data && data.length > 0) {
    const match = data[0].invoice_number.match(/\d+$/)
    if (match) {
      const num = parseInt(match[0], 10)
      if (!isNaN(num) && num > maxCounter) {
        maxCounter = num
      }
    }
  }
  return maxCounter + 1
}

/* ─── Schema for Creating Quotation ─── */
const quotationItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Item name required'),
  unit: z.string().default('piece'),
  quantity: z.number().min(0.01),
  unit_price: z.number().min(0),
  total: z.number().min(0),
  sort_order: z.number().default(0),
})

const createQuotationSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().min(1, 'Customer name required'),
  customer_phone: z.string().optional().nullable(),
  
  subtotal: z.number().min(0).default(0),
  discount_pct: z.number().min(0).max(100).default(0),
  discount_amt: z.number().min(0).default(0),
  tax_amt: z.number().min(0).default(0),
  total: z.number().min(0).default(0),

  valid_until: z.string().optional().nullable(), // YYYY-MM-DD
  notes: z.string().optional().nullable(),
  
  items: z.array(quotationItemSchema).min(1, 'At least 1 item required'),
})

export const quotationsRouter = router({
  /* ─────────────────────────────────────────
     GET SHOP SETTINGS
  ───────────────────────────────────────── */
  getShopSettings: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)
    
    const { data: shopSettings, error } = await supabase
      .from('shops')
      .select('name, address, phone, gstin, upi_id')
      .eq('id', shop.id)
      .single()

    if (error || !shopSettings) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shop not found' })
    return shopSettings
  }),

  /* ─────────────────────────────────────────
     GET NEXT NUMBER
  ───────────────────────────────────────── */
  getNextNumber: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await getShop(supabase, user.id)
    
    const prefix = shop.quotation_prefix || 'QT'
    const nextCounter = await getNextQuotationCounter(supabase, shop.id, shop.quotation_counter || 100)
    
    return {
      prefix,
      nextCounter,
      quotationNumber: `${prefix}-${nextCounter}`,
    }
  }),

  /* ─────────────────────────────────────────
     CREATE
  ───────────────────────────────────────── */
  create: protectedProcedure
    .input(createQuotationSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      const prefix = shop.quotation_prefix || 'QT'
      const counter = await getNextQuotationCounter(supabase, shop.id, shop.quotation_counter || 100)
      const quotationNumber = `${prefix}-${counter}`

      const { items, ...quotationData } = input

      // 1. Insert Quotation
      const { data: quotation, error: qErr } = await supabase
        .from('quotations')
        .insert({
          ...quotationData,
          shop_id: shop.id,
          quotation_number: quotationNumber,
          status: 'draft',
        })
        .select('id')
        .single()

      if (qErr || !quotation) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: qErr?.message || 'Failed to create quotation' })
      }

      // 2. Insert Items
      const itemsToInsert = items.map((item, idx) => ({
        ...item,
        quotation_id: quotation.id,
        sort_order: idx,
      }))

      const { error: itemsErr } = await supabase
        .from('quotation_items')
        .insert(itemsToInsert)

      if (itemsErr) {
        await supabase.from('quotations').delete().eq('id', quotation.id)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: itemsErr.message })
      }

      // 3. Update shop counter
      await supabase
        .from('shops')
        .update({ quotation_counter: counter })
        .eq('id', shop.id)

      // 4. Activity Log
      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'quotation_created',
        entity_type: 'quotation',
        entity_id: quotation.id,
        summary: `Quotation ${quotationNumber} bana - ${input.customer_name} (₹${input.total})`,
      })

      return { id: quotation.id, quotation_number: quotationNumber }
    }),

  /* ─────────────────────────────────────────
     LIST
  ───────────────────────────────────────── */
  list: protectedProcedure
    .input(z.object({ search: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      let query = supabase
        .from('quotations')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })

      if (input?.search && input.search.trim()) {
        const s = `%${input.search.trim()}%`
        query = query.or(`customer_name.ilike.${s},quotation_number.ilike.${s}`)
      }
      
      if (input?.status && input.status !== 'all') {
        query = query.eq('status', input.status)
      }

      const { data, error } = await query
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /* ─────────────────────────────────────────
     GET BY ID
  ───────────────────────────────────────── */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      const { data: quotation, error } = await supabase
        .from('quotations')
        .select('*, items:quotation_items(*)')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (error || !quotation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quotation not found' })

      quotation.items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      return quotation
    }),

  /* ─────────────────────────────────────────
     GET BY NUMBER (For autofill)
  ───────────────────────────────────────── */
  getByNumber: protectedProcedure
    .input(z.object({ quotation_number: z.string() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      const { data: quotation, error } = await supabase
        .from('quotations')
        .select('*, items:quotation_items(*)')
        .ilike('quotation_number', input.quotation_number)
        .eq('shop_id', shop.id)
        .single()

      if (error || !quotation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quotation not found' })

      quotation.items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      return quotation
    }),

  /* ─────────────────────────────────────────
     CONVERT TO INVOICE
  ───────────────────────────────────────── */
  convertToInvoice: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      // Fetch quotation
      const { data: quotation, error: fetchErr } = await supabase
        .from('quotations')
        .select('*, items:quotation_items(*)')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (fetchErr || !quotation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quotation not found' })
      if (quotation.status === 'converted') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already converted' })

      const prefix = shop.invoice_prefix || 'INV'
      const counter = await getNextInvoiceCounter(supabase, shop.id, shop.invoice_counter || 1000)
      const invoiceNumber = `${prefix}-${counter}`

      // Create invoice
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          shop_id: shop.id,
          customer_id: quotation.customer_id,
          quotation_id: quotation.id,
          invoice_number: invoiceNumber,
          customer_name: quotation.customer_name,
          customer_phone: quotation.customer_phone,
          customer_address: '',
          invoice_date: new Date().toISOString().split('T')[0],
          subtotal: quotation.subtotal,
          discount_pct: quotation.discount_pct,
          discount_amt: quotation.discount_amt,
          taxable_amt: quotation.total,
          total: quotation.total,
          balance_due: quotation.total,
        })
        .select('id')
        .single()

      if (invErr || !invoice) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: invErr?.message })

      // Create invoice items
      const invoiceItems = quotation.items.map((item: any) => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        sort_order: item.sort_order,
      }))

      await supabase.from('invoice_items').insert(invoiceItems)

      // Update shop counter
      await supabase.from('shops').update({ invoice_counter: counter }).eq('id', shop.id)

      // Mark quotation as converted
      await supabase.from('quotations').update({ 
        status: 'converted', 
        converted_invoice_id: invoice.id 
      }).eq('id', quotation.id)

      // Activity log
      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'quotation_converted',
        entity_type: 'quotation',
        entity_id: quotation.id,
        summary: `Quotation ${quotation.quotation_number} convert hui bill ${invoiceNumber} me`,
      })

      return { invoice_id: invoice.id }
    }),
})
