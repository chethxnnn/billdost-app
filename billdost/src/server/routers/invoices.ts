import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

import { resolveShopAndRole } from '../utils/auth'

/* ─── Helper ─── */
async function getShop(supabase: any, userId: string) {
  const { shop } = await resolveShopAndRole(supabase, userId)
  return shop
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

/* ─── Schema for Creating Invoice ─── */
const invoiceItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Item name required'),
  hsn_code: z.string().optional().nullable(),
  unit: z.string().default('piece'),
  quantity: z.number().min(0.01),
  unit_price: z.number().min(0),
  making_charge: z.number().optional().nullable(),
  tax_rate: z.number().default(0),
  tax_amt: z.number().default(0),
  total: z.number().min(0),
})

const createInvoiceSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().min(1, 'Customer name required'),
  customer_phone: z.string().optional().nullable(),
  customer_address: z.string().optional().nullable(),
  invoice_date: z.string(), // YYYY-MM-DD
  due_date: z.string().optional().nullable(),
  
  subtotal: z.number().min(0),
  discount_pct: z.number().min(0).max(100).default(0),
  discount_amt: z.number().min(0).default(0),
  taxable_amt: z.number().min(0),
  cgst_amt: z.number().default(0),
  sgst_amt: z.number().default(0),
  igst_amt: z.number().default(0),
  total: z.number().min(0),

  amount_paid: z.number().min(0).default(0),
  balance_due: z.number().min(0).default(0),
  payment_status: z.enum(['unpaid', 'partial', 'paid']).default('unpaid'),
  payment_mode: z.string().optional().nullable(),
  include_upi_qr: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  
  items: z.array(invoiceItemSchema).min(1, 'At least 1 item required'),
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
      .select('name, address, phone, gstin, upi_id')
      .eq('id', shop.id)
      .single()

    if (error || !shopSettings) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shop not found' })
    return shopSettings
  }),

  /* ─────────────────────────────────────────
     GET NEXT NUMBER
     Returns the next logical invoice number (e.g. INV-1005)
  ───────────────────────────────────────── */
  getNextNumber: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await getShop(supabase, user.id)
    
    const prefix = shop.invoice_prefix || 'INV'
    const nextCounter = await getNextInvoiceCounter(supabase, shop.id, shop.invoice_counter || 1000)
    
    return {
      prefix,
      nextCounter,
      invoiceNumber: `${prefix}-${nextCounter}`,
    }
  }),

  /* ─────────────────────────────────────────
     CREATE
     Creates invoice + line items in one go
  ───────────────────────────────────────── */
  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      const prefix = shop.invoice_prefix || 'INV'
      const counter = await getNextInvoiceCounter(supabase, shop.id, shop.invoice_counter || 1000)
      const invoiceNumber = `${prefix}-${counter}`

      let finalCustomerId = input.customer_id
      const { items, ...invoiceData } = input

      // 0. Auto-create or resolve customer
      if (!finalCustomerId && invoiceData.customer_name) {
        // Try to find by phone if provided
        if (invoiceData.customer_phone) {
          const { data: existingCust } = await supabase
            .from('customers')
            .select('id')
            .eq('shop_id', shop.id)
            .eq('phone', invoiceData.customer_phone)
            .single()
            
          if (existingCust) {
            finalCustomerId = existingCust.id
          }
        }
        
        // If still no ID, create new customer
        if (!finalCustomerId) {
          const { data: newCust, error: newCustErr } = await supabase
            .from('customers')
            .insert({
              shop_id: shop.id,
              name: invoiceData.customer_name,
              phone: invoiceData.customer_phone || null,
              address: invoiceData.customer_address || null,
              // Stats will be updated below in step 4
            })
            .select('id')
            .single()
            
          if (!newCustErr && newCust) {
            finalCustomerId = newCust.id
          }
        }
      }

      // 1. Insert Invoice
      const { data: invoice, error: invoiceErr } = await supabase
        .from('invoices')
        .insert({
          ...invoiceData,
          customer_id: finalCustomerId,
          shop_id: shop.id,
          invoice_number: invoiceNumber,
          paid_at: invoiceData.payment_status === 'paid' ? new Date().toISOString() : null,
        })
        .select('id')
        .single()

      if (invoiceErr || !invoice) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: invoiceErr?.message || 'Failed to create invoice' })
      }

      // 2. Insert Items
      const itemsToInsert = items.map((item, idx) => ({
        ...item,
        invoice_id: invoice.id,
        sort_order: idx,
      }))

      const { error: itemsErr } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)

      if (itemsErr) {
        // Very basic rollback since we don't have stored RPC for this transaction yet
        await supabase.from('invoices').delete().eq('id', invoice.id)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: itemsErr.message })
      }

      // 3. Deduct Stock & Write Ledger (for items with product_id)
      for (const item of items) {
        if (item.product_id) {
          // fetch current stock
          const { data: prod } = await supabase
            .from('products')
            .select('stock_qty')
            .eq('id', item.product_id)
            .single()

          if (prod && prod.stock_qty !== null) {
            const prevStock = prod.stock_qty
            const newStock = prevStock - item.quantity

            // update products
            await supabase
              .from('products')
              .update({ stock_qty: newStock })
              .eq('id', item.product_id)

            // insert into inventory_logs
            await supabase
              .from('inventory_logs')
              .insert({
                shop_id: shop.id,
                product_id: item.product_id,
                type: 'SALE',
                quantity_change: -item.quantity,
                previous_stock: prevStock,
                new_stock: newStock,
                reference_id: invoice.id,
                reference_number: invoiceNumber,
                notes: `Sold via Bill ${invoiceNumber}`,
                created_by: user.id
              })
          }
        }
      }

      // 4. Update shop counter
      await supabase
        .from('shops')
        .update({ invoice_counter: counter })
        .eq('id', shop.id)

      // 4. Update customer stats if customer_id exists
      if (finalCustomerId) {
        // Fetch current customer stats to increment
        const { data: cust } = await supabase
          .from('customers')
          .select('total_billed, total_paid, bill_count')
          .eq('id', finalCustomerId)
          .single()
        
        if (cust) {
          await supabase
            .from('customers')
            .update({
              total_billed: Number(cust.total_billed || 0) + input.total,
              total_paid: Number(cust.total_paid || 0) + input.amount_paid,
              bill_count: Number(cust.bill_count || 0) + 1,
              last_billed: new Date().toISOString(),
            })
            .eq('id', finalCustomerId)
        }
      }

      // 5. Activity Log
      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'invoice_created',
        entity_type: 'invoice',
        entity_id: invoice.id,
        summary: `Bill ${invoiceNumber} bana - ${input.customer_name} (₹${input.total})`,
      })

      return { id: invoice.id, invoice_number: invoiceNumber }
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
        const s = `%${input.search.trim()}%`
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
        .select('name, address, phone, gstin, upi_id')
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
     Marks an invoice as paid and updates customer stats
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

      // Fetch invoice first to verify and get current balance
      const { data: invoice, error: fetchErr } = await supabase
        .from('invoices')
        .select('id, total, amount_paid, balance_due, payment_status, customer_id, invoice_number')
        .eq('id', input.id)
        .eq('shop_id', shop.id)
        .single()

      if (fetchErr || !invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' })
      if (invoice.payment_status === 'paid' || invoice.balance_due <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invoice is already fully paid' })
      }

      // Calculate new balances
      const newAmountPaid = Number(invoice.amount_paid) + input.amount_paid
      const newBalanceDue = Math.max(0, Number(invoice.total) - newAmountPaid)
      const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial'

      // Update invoice
      const { error: updateErr } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          payment_status: newStatus,
          payment_mode: input.payment_mode,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : null
        })
        .eq('id', invoice.id)

      if (updateErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updateErr.message })

      // Update customer stats if customer exists
      if (invoice.customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('total_paid')
          .eq('id', invoice.customer_id)
          .single()
          
        if (cust) {
          await supabase
            .from('customers')
            .update({ total_paid: Number(cust.total_paid || 0) + input.amount_paid })
            .eq('id', invoice.customer_id)
        }
      }

      // Log Payment
      await supabase.from('payments').insert({
        shop_id: shop.id,
        invoice_id: invoice.id,
        amount: input.amount_paid,
        mode: input.payment_mode,
      })

      // Activity Log
      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'payment_received',
        entity_type: 'invoice',
        entity_id: invoice.id,
        summary: `Payment received: ₹${input.amount_paid} for Bill ${invoice.invoice_number}`,
      })

      return { success: true, newStatus, newBalanceDue }
    }),

  /* ─────────────────────────────────────────
     BULK MARK PAID
  ───────────────────────────────────────── */
  bulkMarkPaid: protectedProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()),
      payment_mode: z.string().default('cash')
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await getShop(supabase, user.id)

      if (input.ids.length === 0) return { success: true, count: 0 }

      // Fetch unpaid invoices
      const { data: invoices, error: fetchErr } = await supabase
        .from('invoices')
        .select('id, balance_due, customer_id, invoice_number')
        .in('id', input.ids)
        .eq('shop_id', shop.id)
        .gt('balance_due', 0)

      if (fetchErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: fetchErr.message })
      if (!invoices || invoices.length === 0) return { success: true, count: 0 }

      let totalCollected = 0
      const customerUpdates: Record<string, number> = {}

      for (const inv of invoices) {
        totalCollected += Number(inv.balance_due)
        
        // Update Invoice
        await supabase
          .from('invoices')
          .update({
            amount_paid: supabase.rpc('increment_amount_paid', { val: Number(inv.balance_due) }), // Simplification
            balance_due: 0,
            payment_status: 'paid',
            payment_mode: input.payment_mode,
            paid_at: new Date().toISOString()
          })
          .eq('id', inv.id)

        // Calculate customer updates
        if (inv.customer_id) {
          customerUpdates[inv.customer_id] = (customerUpdates[inv.customer_id] || 0) + Number(inv.balance_due)
        }

        // Log payment
        await supabase.from('payments').insert({
          shop_id: shop.id,
          invoice_id: inv.id,
          amount: Number(inv.balance_due),
          mode: input.payment_mode,
        })
      }

      // We need to do a custom direct query for the amount_paid increment since Supabase RPC might not exist.
      // A better way: Just update amount_paid = total since we know balance_due is fully paid
      for (const inv of invoices) {
        await supabase
          .from('invoices')
          .update({
             balance_due: 0,
             payment_status: 'paid',
             payment_mode: input.payment_mode,
             paid_at: new Date().toISOString()
          })
          .eq('id', inv.id)
        
        // Fix amount_paid explicitly by getting total
        const { data: invFull } = await supabase.from('invoices').select('total').eq('id', inv.id).single()
        if (invFull) {
           await supabase.from('invoices').update({ amount_paid: invFull.total }).eq('id', inv.id)
        }
      }

      // Log activity
      await supabase.from('activity_log').insert({
        shop_id: shop.id,
        type: 'payment_received',
        entity_type: 'invoice',
        entity_id: invoices[0].id,
        summary: `Bulk marked ${invoices.length} bill(s) as paid (Total ₹${totalCollected})`,
      })

      return { success: true, count: invoices.length }
    }),
})
