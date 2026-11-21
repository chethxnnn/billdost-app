import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireShopAccess } from '../utils/auth'
import { ALLOWED_TAX_RATES, GSTIN_REGEX, computeTotals } from '@/lib/money'
import { getCustomerTaxFacts, getShopTaxFacts } from '../utils/taxFacts'
import { mapRpcError } from '../utils/rpcErrors'
import { orIlikePattern } from '@/lib/search'

/* ─── Helper ─── */
async function getShop(supabase: any, userId: string) {
  return await requireShopAccess(supabase, userId)
}

/* ─── Schema for Creating Quotation ───
   Inputs only (blueprint C3): totals are recomputed server-side with
   src/lib/money.ts, exactly like invoices.create, then written
   atomically by create_quotation_tx (migration 0013). */
const taxRateSchema = z
  .number()
  .refine((r) => (ALLOWED_TAX_RATES as readonly number[]).includes(r), {
    message: 'Tax rate must be a valid GST slab',
  })

const gstinSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => GSTIN_REGEX.test(v), { message: 'Invalid GSTIN format' })

const quotationItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Item name required'),
  hsn_code: z.string().optional().nullable(),
  unit: z.string().default('piece'),
  quantity: z.number().min(0.01),
  unit_price: z.number().min(0),
  making_charge: z.number().min(0).optional().nullable(),
  tax_rate: taxRateSchema.default(0),
  discount_pct: z.number().min(0).max(100).default(0),
  sort_order: z.number().default(0),
})

const createQuotationSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().min(1, 'Customer name required'),
  customer_phone: z.string().optional().nullable(),
  customer_address: z.string().optional().nullable(),
  customer_gstin: gstinSchema.optional().nullable(),
  customer_state: z.string().optional().nullable(),
  customer_state_code: z
    .string()
    .regex(/^\d{2}$/, 'State code must be 2 digits')
    .optional()
    .nullable(),

  discount_pct: z.number().min(0).max(100).default(0),

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
      .select('name, address, phone, gstin, upi_id, state, logo_url, terms_conditions')
      .eq('id', shop.id)
      .single()

    if (error || !shopSettings) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shop not found' })
    return shopSettings
  }),

  /* ─────────────────────────────────────────
     GET NEXT NUMBER
     Preview only: the counter is advanced atomically inside
     create_quotation_tx, so this number is not reserved.
  ───────────────────────────────────────── */
  getNextNumber: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await getShop(supabase, user.id)

    const prefix = shop.quotation_prefix || 'QT'
    const nextCounter = (shop.quotation_counter || 100) + 1

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
      const { items } = input

      // 1. Recompute every rupee server-side with the shared money engine.
      const shopTax = await getShopTaxFacts(supabase, shop)
      const customerTax = await getCustomerTaxFacts(supabase, shop.id, input.customer_id, input)
      const totals = computeTotals({
        items: items.map((item) => ({
          name: item.name,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          unit_price: item.unit_price,
          making_charge: item.making_charge,
          tax_rate: item.tax_rate,
          discount_pct: item.discount_pct,
        })),
        discount_pct: input.discount_pct,
        shop_state_code: shopTax.stateCode,
        customer_state_code: customerTax.stateCode,
        customer_gstin: customerTax.gstin,
        is_gst_registered: shopTax.isGstRegistered,
        round_off: shopTax.roundOff,
      })

      // 2. One atomic RPC writes the quotation and its items. A supplied
      // customer_id is re-validated against the shop inside it (C5).
      const payload = {
        customer_id: input.customer_id || null,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone || null,
        customer_address: input.customer_address || null,
        customer_gstin: customerTax.gstin,
        customer_state_code: customerTax.stateCode,
        discount_pct: input.discount_pct,
        valid_until: input.valid_until || null,
        notes: input.notes || null,
        is_interstate: totals.is_interstate,
        place_of_supply_state_code: totals.place_of_supply_state_code,
        totals: {
          subtotal: totals.subtotal,
          discount_amt: totals.discount_amt,
          taxable_amt: totals.taxable_amt,
          cgst_amt: totals.cgst_amt,
          sgst_amt: totals.sgst_amt,
          igst_amt: totals.igst_amt,
          round_off_amt: totals.round_off_amt,
          total: totals.total,
        },
        items: items.map((item, idx) => ({
          product_id: item.product_id || null,
          name: item.name,
          hsn_code: item.hsn_code || null,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          making_charge: item.making_charge || 0,
          tax_rate: item.tax_rate,
          discount_amt: totals.lines[idx].discount_amt,
          taxable_amt: totals.lines[idx].taxable_amt,
          tax_amt: totals.lines[idx].tax_amt,
          total: totals.lines[idx].total,
          sort_order: idx,
        })),
      }

      const { data: quotationId, error: rpcError } = await supabase.rpc('create_quotation_tx', {
        p_shop_id: shop.id,
        p_actor: user.id,
        p_payload: payload,
      })

      if (rpcError || !quotationId) throw mapRpcError(rpcError)

      const { data: created } = await supabase
        .from('quotations')
        .select('quotation_number')
        .eq('id', quotationId)
        .single()

      return { id: quotationId as string, quotation_number: created?.quotation_number as string }
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
        const s = orIlikePattern(input.search)
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
     UPDATE STATUS (Stage 3 completeness)
     The schema always had draft/sent/accepted/rejected/expired with
     sent_at and responded_at columns, but no mutation existed, so the
     UI could never move a quotation. Transitions are validated here;
     converted quotations are final. Any shop member may mark status
     (a counter action), matching how invoices record payment.
  ───────────────────────────────────────── */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      const { data: quotation, error: fetchError } = await supabase
        .from('quotations')
        .select('id, status')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (fetchError || !quotation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quotation not found' })
      }

      if (quotation.status === 'converted') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ye quotation bill ban chuka hai, status nahi badlega.',
        })
      }

      const allowed: Record<string, string[]> = {
        draft: ['sent', 'accepted', 'rejected', 'expired'],
        sent: ['accepted', 'rejected', 'expired'],
        accepted: [],
        rejected: [],
        expired: ['draft'],
      }
      if (!(allowed[quotation.status] ?? []).includes(input.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Quotation ${quotation.status} se ${input.status} nahi ho sakta.`,
        })
      }

      const patch: Record<string, unknown> = { status: input.status }
      if (input.status === 'sent') patch.sent_at = new Date().toISOString()
      if (input.status === 'accepted' || input.status === 'rejected') {
        patch.responded_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('quotations')
        .update(patch)
        .eq('id', input.id)
        .eq('shop_id', shop.id)

      if (updateError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updateError.message })

      return { success: true, status: input.status }
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
     Delegates to convert_quotation_tx: tax, address and GSTIN snapshots
     are carried over, stock is deducted, stats move via trigger, and
     the quotation is marked converted in the same transaction (C8).
  ───────────────────────────────────────── */
  convertToInvoice: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      const { data: quotation } = await supabase
        .from('quotations')
        .select('id')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (!quotation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quotation not found' })

      const { data: invoiceId, error } = await supabase.rpc('convert_quotation_tx', {
        p_quotation_id: input.id,
        p_actor: user.id,
      })

      if (error) throw mapRpcError(error)

      return { invoice_id: invoiceId as string }
    }),
})
