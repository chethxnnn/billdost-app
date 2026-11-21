import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireManagerOrOwner, requireOwner, requireShopAccess } from '../utils/auth'
import {
  WhatsAppError,
  getConnectionStatus,
  logReminder,
  sendInvoiceTemplate,
  sendLowStockDigestTemplate,
  sendQuotationTemplate,
  sendReminderTemplate,
  sendTestTemplate,
} from '../whatsapp'

function toTRPCError(err: unknown): TRPCError {
  if (err instanceof WhatsAppError) {
    if (err.code === 'NOT_CONNECTED') return new TRPCError({ code: 'PRECONDITION_FAILED', message: err.message })
    if (err.code === 'BAD_PHONE' || err.code === 'NO_PDF') return new TRPCError({ code: 'BAD_REQUEST', message: err.message })
    return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message })
  }
  return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'WhatsApp bhejne mein kuch gadbad ho gayi.' })
}

export const whatsappRouter = router({
  /**
   * Connection status for the settings screen. Honest states only:
   * not_configured until a shop number or the shared BillDost number
   * plus a token actually exist.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireShopAccess(supabase, user.id)
    return getConnectionStatus(shop.id)
  }),

  /**
   * Stores the shop's own Cloud API identity (owner only). The Meta
   * side of this (Embedded Signup or manual WABA setup) happens with
   * Chethan after the app is ready; this is where the resulting ids
   * land. Saving ids does not fake a connection: sends still go
   * through Meta and fail loudly if the ids or token are wrong.
   */
  saveConnection: protectedProcedure
    .input(z.object({
      phone_number_id: z.string().min(1),
      waba_id: z.string().min(1),
      display_phone: z.string().max(20).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)

      const { data, error } = await supabase
        .from('whatsapp_connections')
        .upsert({
          shop_id: shop.id,
          phone_number_id: input.phone_number_id,
          waba_id: input.waba_id,
          display_phone: input.display_phone ?? null,
          status: 'connected',
          connected_at: new Date().toISOString(),
          last_error: null,
        })
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /** Disconnects the shop's own number (owner only). */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireOwner(supabase, user.id)

    const { error } = await supabase
      .from('whatsapp_connections')
      .upsert({
        shop_id: shop.id,
        phone_number_id: null,
        waba_id: null,
        display_phone: null,
        status: 'disconnected',
        connected_at: null,
      })

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return { success: true }
  }),

  /**
   * Sends an invoice PDF to the customer through the Cloud API. Any
   * active member can send a bill. The client supplies the generated
   * PDF as base64 (or a fetchable pdf_url); without one the send is
   * refused rather than sending a bill-less message.
   */
  sendInvoice: protectedProcedure
    .input(z.object({
      invoiceId: z.string().uuid(),
      pdfBase64: z.string().max(14_000_000).optional().nullable(),
      pdfUrl: z.string().url().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, customer_name, customer_phone, total')
        .eq('id', input.invoiceId)
        .eq('shop_id', shop.id)
        .single()

      if (error || !invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' })
      if (!invoice.customer_phone) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Customer ka phone number nahi hai!' })
      }

      try {
        const result = await sendInvoiceTemplate({
          shopId: shop.id,
          invoiceId: invoice.id,
          toPhone: invoice.customer_phone,
          shopName: shop.name,
          invoiceNumber: invoice.invoice_number,
          amount: Number(invoice.total),
          pdfBase64: input.pdfBase64 ?? null,
          pdfUrl: input.pdfUrl ?? null,
        })
        return { success: true, send_id: result.sendId }
      } catch (err) {
        throw toTRPCError(err)
      }
    }),

  /**
   * Sends a quotation PDF to the customer through the Cloud API, the
   * mirror of sendInvoice (blueprint C8). On a successful send a draft
   * quotation is marked sent with sent_at, so the status the customer
   * acted on is the status the shop sees.
   */
  sendQuotation: protectedProcedure
    .input(z.object({
      quotationId: z.string().uuid(),
      pdfBase64: z.string().max(14_000_000).optional().nullable(),
      pdfUrl: z.string().url().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      const { data: quotation, error } = await supabase
        .from('quotations')
        .select('id, quotation_number, customer_id, customer_name, customer_phone, total, status')
        .eq('id', input.quotationId)
        .eq('shop_id', shop.id)
        .single()

      if (error || !quotation) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quotation not found' })
      if (!quotation.customer_phone) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Customer ka phone number nahi hai!' })
      }

      try {
        const result = await sendQuotationTemplate({
          shopId: shop.id,
          quotationId: quotation.id,
          customerId: quotation.customer_id,
          toPhone: quotation.customer_phone,
          shopName: shop.name,
          quotationNumber: quotation.quotation_number,
          amount: Number(quotation.total),
          pdfBase64: input.pdfBase64 ?? null,
          pdfUrl: input.pdfUrl ?? null,
        })

        if (quotation.status === 'draft') {
          await supabase
            .from('quotations')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', quotation.id)
            .eq('shop_id', shop.id)
        }

        return { success: true, send_id: result.sendId }
      } catch (err) {
        throw toTRPCError(err)
      }
    }),

  /**
   * Sends one udhaar reminder to a customer (blueprint D7, manager and
   * owner: template sends cost money). The amount is the customer's
   * true outstanding: opening balance plus the balance_due of every
   * active bill, read at send time so a customer who just paid is
   * never reminded. Every attempt is written to reminder_log.
   */
  sendReminder: protectedProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { data: customer, error } = await supabase
        .from('customers')
        .select('id, name, phone, whatsapp, opening_balance, reminders_paused')
        .eq('id', input.customerId)
        .eq('shop_id', shop.id)
        .single()

      if (error || !customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      if (customer.reminders_paused) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Is customer ke reminders band hain.' })
      }

      const { data: dueBills } = await supabase
        .from('invoices')
        .select('id, balance_due')
        .eq('shop_id', shop.id)
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .gt('balance_due', 0)
        .order('invoice_date', { ascending: true })

      const billsDue = (dueBills ?? []).reduce((s: number, b: any) => s + Number(b.balance_due || 0), 0)
      const outstanding = Math.round((Number(customer.opening_balance || 0) + billsDue) * 100) / 100
      if (outstanding <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Is customer ka koi udhaar baaki nahi hai.' })
      }

      const phone = customer.whatsapp || customer.phone
      if (!phone) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Customer ka phone number nahi hai!' })
      }

      const oldestBillId = dueBills && dueBills.length > 0 ? dueBills[0].id : null
      try {
        const result = await sendReminderTemplate({
          shopId: shop.id,
          customerId: customer.id,
          toPhone: phone,
          customerName: customer.name,
          shopName: shop.name,
          amount: outstanding,
        })
        await logReminder({ shopId: shop.id, customerId: customer.id, invoiceId: oldestBillId, status: 'sent' })
        return { success: true, send_id: result.sendId, amount: outstanding }
      } catch (err) {
        await logReminder({ shopId: shop.id, customerId: customer.id, invoiceId: oldestBillId, status: 'failed' })
        throw toTRPCError(err)
      }
    }),

  /**
   * Sends the low-stock digest to the shop owner's own number
   * (blueprint D20, manual trigger; no cron in the free-tier pilot).
   * Honest states: alerts toggle off, nothing low, no shop phone, or
   * WhatsApp not connected each produce a specific refusal.
   */
  sendLowStockDigest: protectedProcedure.mutation(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    const { data: shopRow } = await supabase
      .from('shops')
      .select('phone, low_stock_alerts')
      .eq('id', shop.id)
      .single()

    if (shopRow && shopRow.low_stock_alerts === false) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Low stock WhatsApp alerts band hain. Pehle on karo.' })
    }
    if (!shopRow?.phone) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Shop ka phone number settings mein nahi hai.' })
    }

    const { data } = await supabase
      .from('products')
      .select('id, name, stock_qty, low_stock_alert')
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .not('low_stock_alert', 'is', null)
      .not('stock_qty', 'is', null)

    const low = (data ?? []).filter(
      (p: any) => Number(p.stock_qty) <= Number(p.low_stock_alert)
    )
    if (low.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Abhi koi item low stock mein nahi hai.' })
    }

    const names = low.slice(0, 5).map((p: any) => p.name)
    const itemsText =
      names.join(', ') + (low.length > 5 ? ` aur ${low.length - 5} items` : '')

    try {
      const result = await sendLowStockDigestTemplate({
        shopId: shop.id,
        toPhone: shopRow.phone,
        shopName: shop.name,
        itemsText,
        count: low.length,
        productIds: low.map((p: any) => p.id),
      })
      return { success: true, send_id: result.sendId, count: low.length }
    } catch (err) {
      throw toTRPCError(err)
    }
  }),

  /**
   * Sends a real test template message to the given number (manager
   * and owner). Used by the settings screen to verify a connection.
   */
  sendTestMessage: protectedProcedure
    .input(z.object({ phone: z.string().min(10).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      try {
        const result = await sendTestTemplate({ shopId: shop.id, toPhone: input.phone })
        return { success: true, send_id: result.sendId }
      } catch (err) {
        throw toTRPCError(err)
      }
    }),

  /** Recent sends for this shop, newest first (manager and owner). */
  listSends: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { data, error } = await supabase
        .from('whatsapp_sends')
        .select('id, invoice_id, to_phone, template_name, status, error, created_at')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(input?.limit ?? 20)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data ?? []
    }),
})
