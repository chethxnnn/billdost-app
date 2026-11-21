import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireManagerOrOwner, resolveShopAndRole } from '../utils/auth'
import { orIlikePattern } from '@/lib/search'

/* ─── Shared schema ─── */
const customerInput = z.object({
  name:     z.string().min(1, 'Name required').max(100),
  phone:    z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  email:    z.string().email('Invalid email').max(100).optional().nullable(),
  address:  z.string().max(300).optional().nullable(),
  notes:    z.string().max(500).optional().nullable(),
  tags:     z.array(z.string()).default([]),
  // Place-of-supply facts (migration 0003): GSTIN and state drive the
  // IGST vs CGST/SGST decision in src/lib/money.ts.
  gstin:    z.string().max(15).optional().nullable(),
  state:    z.string().max(60).optional().nullable(),
  state_code: z.string().regex(/^\d{2}$/).optional().nullable(),
})

/* ─── Helper ─── */
async function getShop(supabase: any, userId: string) {
  const { shop } = await resolveShopAndRole(supabase, userId)
  return shop
}


export const customersRouter = router({
  /* ─────────────────────────────────────────
     LIST - all customers for the shop
     Supports optional ?search
  ───────────────────────────────────────── */
  list: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      let query = supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (input?.search && input.search.trim()) {
        const s = orIlikePattern(input.search)
        query = query.or(`name.ilike.${s},phone.ilike.${s}`)
      }

      const { data, error } = await query

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data ?? []
    }),

  /* ─────────────────────────────────────────
     CREATE
  ───────────────────────────────────────── */
  create: protectedProcedure
    .input(customerInput)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      // If phone is provided, check if it already exists for this shop
      if (input.phone) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('shop_id', shop.id)
          .eq('phone', input.phone)
          .single()

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Ye phone number pehle se ek customer ke paas hai.',
          })
        }
      }

      const { data, error } = await supabase
        .from('customers')
        .insert({ ...input, shop_id: shop.id })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Phone number already exists' })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      // Log activity
      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'customer_added',
        entity_type: 'customer',
        entity_id: data.id,
        summary: `Naya customer add hua: ${input.name}`,
      })

      return data
    }),

  /* ─────────────────────────────────────────
     CREATE MANY (Bulk Import)
  ───────────────────────────────────────── */
  createMany: protectedProcedure
    .input(z.array(customerInput))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      if (input.length === 0) return { imported: 0, skipped: 0 }

      // 1. Fetch existing phones for this shop to prevent duplicates
      const { data: existingPhonesData } = await supabase
        .from('customers')
        .select('phone')
        .eq('shop_id', shop.id)
        .not('phone', 'is', null)

      const existingPhones = new Set(existingPhonesData?.map(c => c.phone) || [])

      // 2. Filter input: skip if phone already exists or is duplicated in the CSV itself
      const validCustomers = []
      const seenPhonesInCsv = new Set()
      let skippedCount = 0

      for (const c of input) {
        if (c.phone) {
          if (existingPhones.has(c.phone) || seenPhonesInCsv.has(c.phone)) {
            skippedCount++
            continue
          }
          seenPhonesInCsv.add(c.phone)
        }
        validCustomers.push({ ...c, shop_id: shop.id })
      }

      if (validCustomers.length === 0) {
        return { imported: 0, skipped: skippedCount }
      }

      // 3. Bulk Insert
      const { data, error } = await supabase
        .from('customers')
        .insert(validCustomers)
        .select('id')

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      // 4. Log activity
      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'bulk_import',
        entity_type: 'shop',
        entity_id: shop.id,
        summary: `${validCustomers.length} naye customers CSV se add kiye gaye.`,
      })

      return { imported: validCustomers.length, skipped: skippedCount }
    }),

  /* ─────────────────────────────────────────
     UPDATE
  ───────────────────────────────────────── */
  update: protectedProcedure
    .input(customerInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)
      const { id, ...fields } = input

      // If phone is provided, check if it already exists for THIS shop but DIFFERENT customer
      if (fields.phone) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('shop_id', shop.id)
          .eq('phone', fields.phone)
          .neq('id', id)
          .single()

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Ye phone number kisi aur customer ka hai.',
          })
        }
      }

      const { data, error } = await supabase
        .from('customers')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('shop_id', shop.id)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /* ─────────────────────────────────────────
     DELETE (soft, blueprint C4): manager and owner only. The row is
     kept (bills reference it), is_active flips to false and the list
     stops showing the customer. There is no hard delete in the app.
  ───────────────────────────────────────── */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { error } = await supabase
        .from('customers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('shop_id', shop.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  /* ─────────────────────────────────────────
     GET ANALYTICS
  ───────────────────────────────────────── */
  getAnalytics: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      // Fetch the customer details
      const { data: customer, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (custError || !customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      // Fetch all invoices for this customer
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, total, amount_paid, balance_due, payment_status, due_date')
        .eq('customer_id', input.id)
        .eq('shop_id', shop.id)
        .order('invoice_date', { ascending: false })

      if (invError) {
         throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: invError.message })
      }

      // Calculate stats
      let total_billed = 0
      let total_paid = 0
      let balance_due = 0

      for (const inv of (invoices || [])) {
        total_billed += inv.total || 0
        total_paid += inv.amount_paid || 0
        balance_due += inv.balance_due || 0
      }

      return {
        customer,
        stats: {
          total_billed,
          total_paid,
          balance_due,
          bill_count: (invoices || []).length
        },
        recent_invoices: invoices || []
      }
    }),
})
