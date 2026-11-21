import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

import { requireManagerOrOwner, resolveShopAndRole } from '../utils/auth'
import { ALLOWED_TAX_RATES, GSTIN_REGEX, computeTotals } from '@/lib/money'
import { getCustomerTaxFacts, getShopTaxFacts } from '../utils/taxFacts'
import { mapRpcError } from '../utils/rpcErrors'
import { orIlikePattern } from '@/lib/search'

/* ─── Helper ─── */
async function getShop(supabase: any, userId: string) {
  const { shop } = await resolveShopAndRole(supabase, userId)
  return shop
}

/* ─── Schema for Creating Invoice ───
   Inputs only (blueprint C3): the client sends facts, never money. Every
   total, tax split, balance and payment status is recomputed server-side
   by src/lib/money.ts, then written atomically by create_invoice_tx
   (migration 0006), which re-validates the arithmetic, owns the invoice
   number, deducts stock, writes the payments ledger row and lets the
   customer-stats trigger maintain the customer aggregates. */
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

const invoiceItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Item name required'),
  hsn_code: z.string().optional().nullable(),
  unit: z.string().default('piece'),
  quantity: z.number().min(0.01),
  unit_price: z.number().min(0),
  making_charge: z.number().min(0).optional().nullable(),
  tax_rate: taxRateSchema.default(0),
  discount_pct: z.number().min(0).max(100).default(0),
})

const createInvoiceSchema = z
  .object({
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
    invoice_date: z.string(), // YYYY-MM-DD
    due_date: z.string().optional().nullable(),

    discount_pct: z.number().min(0).max(100).default(0),

    // The one cash fact the client may state: how much was collected at
    // the counter. Status and balance are derived from it server-side.
    amount_paid_at_creation: z.number().min(0).default(0),
    payment_mode: z.string().optional().nullable(),
    include_upi_qr: z.boolean().default(true),
    notes: z.string().optional().nullable(),
    // Origin tag (blueprint D4): the POS counter mode creates through
    // this same path with source 'pos'. create_invoice_tx already
    // reads payload.source and defaults to 'app'.
    source: z.enum(['app', 'pos']).optional(),

    items: z.array(invoiceItemSchema).min(1, 'At least 1 item required'),
  })
  .superRefine((val, ctx) => {
    if (val.due_date && val.due_date < val.invoice_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['due_date'],
        message: 'Due date cannot be before invoice date',
      })
    }
  })

export const invoicesRouter = router({
  /* ─────────────────────────────────────────
     GET SHOP SETTINGS (For PDF generation)
  ───────────────────────────────────────── */
  getShopSettings: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await getShop(supabase, user.id)

    // For settings, we need to fetch additional fields since resolveShopAndRole returns a subset
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
     create_invoice_tx, so this number is not reserved.
  ───────────────────────────────────────── */
  getNextNumber: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await getShop(supabase, user.id)

    const prefix = shop.invoice_prefix || 'INV'
    const nextCounter = (shop.invoice_counter || 1000) + 1

    return {
      prefix,
      nextCounter,
      invoiceNumber: `${prefix}-${nextCounter}`,
    }
  }),

  /* ─────────────────────────────────────────
     CREATE
     Recompute with money.ts, then one create_invoice_tx call performs
     every write (invoice, items, stock, ledger, activity) atomically.
  ───────────────────────────────────────── */
  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)
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

      const amountPaid = input.amount_paid_at_creation
      if (amountPaid > totals.total) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Amount paid cannot be more than the bill total',
        })
      }

      // 2. One atomic RPC writes everything. Customer ownership, product
      // ownership and stock sufficiency are re-checked inside it
      // (blueprint C5), so a forged payload writes nothing at all.
      const payload = {
        customer_id: input.customer_id || null,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone || null,
        customer_address: input.customer_address || null,
        customer_gstin: customerTax.gstin,
        customer_state_code: customerTax.stateCode,
        invoice_date: input.invoice_date,
        due_date: input.due_date || null,
        discount_pct: input.discount_pct,
        amount_paid: amountPaid,
        payment_mode: input.payment_mode || null,
        include_upi_qr: input.include_upi_qr,
        notes: input.notes || null,
        source: input.source || 'app',
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

      const { data: invoiceId, error: rpcError } = await supabase.rpc('create_invoice_tx', {
        p_shop_id: shop.id,
        p_actor: user.id,
        p_payload: payload,
      })

      if (rpcError || !invoiceId) throw mapRpcError(rpcError)

      const { data: created } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('id', invoiceId)
        .single()

      return { id: invoiceId as string, invoice_number: created?.invoice_number as string }
    }),

  /* ─────────────────────────────────────────
     LIST
     Returns all invoices for the shop
  ───────────────────────────────────────── */
  list: protectedProcedure
    .input(z.object({ search: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      let query = supabase
        .from('invoices')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })

      if (input?.search && input.search.trim()) {
        const s = orIlikePattern(input.search)
        query = query.or(`customer_name.ilike.${s},invoice_number.ilike.${s}`)
      }

      if (input?.status && input.status !== 'all') {
        query = query.eq('payment_status', input.status)
      }

      const { data, error } = await query
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data ?? []
    }),

  /* ─────────────────────────────────────────
     GET
     Returns a single invoice with its items
  ───────────────────────────────────────── */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (error || !invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' })

      const { data: items } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sort_order', { ascending: true })

      // Get shop details for the PDF
      const { data: shopDetails } = await supabase
        .from('shops')
        .select('id, name, address, phone, gstin, upi_id, logo_url, terms_conditions')
        .eq('id', shop.id)
        .single()

      return {
        ...invoice,
        items: items ?? [],
        shop: shopDetails,
      }
    }),

  /* ─────────────────────────────────────────
     RECORD PAYMENT
     Delegates to record_payment_tx: the invoice row is locked, the
     amount is capped at balance_due inside the database, the payments
     ledger row and the customer stats move in the same transaction.
  ───────────────────────────────────────── */
  recordPayment: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      payment_mode: z.string(),
      amount_paid: z.number().min(0.01)
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      // Shop-scope check first so a foreign invoice id reads as missing.
      const { data: invoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' })

      const { data: result, error } = await supabase.rpc('record_payment_tx', {
        p_invoice_id: input.id,
        p_amount: input.amount_paid,
        p_mode: input.payment_mode,
        p_actor: user.id,
      })

      if (error) throw mapRpcError(error)

      const updated = result as { amount_paid: number; balance_due: number; payment_status: string }
      return {
        success: true,
        newStatus: updated.payment_status,
        newBalanceDue: updated.balance_due,
      }
    }),

  /* ─────────────────────────────────────────
     BULK MARK PAID
     Manager and owner only (blueprint C4). One bulk_mark_paid_tx call
     settles every selected bill; already-paid bills are skipped inside
     the RPC and the returned count is the number actually marked.
  ───────────────────────────────────────── */
  bulkMarkPaid: protectedProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()).min(1).max(200),
      payment_mode: z.string().default('cash')
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      await requireManagerOrOwner(supabase, user.id)

      const { data: marked, error } = await supabase.rpc('bulk_mark_paid_tx', {
        p_invoice_ids: input.ids,
        p_actor: user.id,
      })

      if (error) throw mapRpcError(error)

      return { success: true, count: marked as number }
    }),

  /* ─────────────────────────────────────────
     CANCEL
     Manager and owner only. cancel_invoice_tx reverses stock and lets
     the stats trigger subtract the bill. A bill with receipts raises
     has_payments until a refund is recorded (blueprint B.6, C10).
  ───────────────────────────────────────── */
  cancel: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().max(300).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { data: invoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' })

      const { error } = await supabase.rpc('cancel_invoice_tx', {
        p_invoice_id: input.id,
        p_reason: input.reason || null,
        p_actor: user.id,
      })

      if (error) throw mapRpcError(error)

      return { success: true }
    }),
})
