import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireOwner, requireManagerOrOwner, requireShopAccess } from '../utils/auth'

export const settingsRouter = router({
  getShopSettings: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    const { data: shopSettings, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shop.id)
      .single()

    if (error || !shopSettings) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shop not found' })
    return shopSettings
  }),

  /**
   * The shop record is the single source of truth for the app language
   * (onboarding writes it, the dashboard syncs from it). Any shop member
   * may switch it; it is a display preference, not a business setting.
   */
  updateLanguage: protectedProcedure
    .input(z.object({ language: z.enum(['en', 'hi', 'kn']) }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)

      const { error } = await supabase
        .from('shops')
        .update({ language: input.language })
        .eq('id', shop.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true, language: input.language }
    }),

  updateGeneral: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      address: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      gstin: z.string().optional().nullable(),
      upi_id: z.string().optional().nullable(),
      logo_url: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id) // Only owner can change critical details

      const { data, error } = await supabase
        .from('shops')
        .update({
          name: input.name,
          address: input.address,
          phone: input.phone,
          gstin: input.gstin,
          upi_id: input.upi_id,
          ...(input.logo_url !== undefined && { logo_url: input.logo_url })
        })
        .eq('id', shop.id)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  /**
   * Low-stock WhatsApp digest on/off (blueprint D20). The digest
   * send refuses while this is off; the in-app centre always works.
   */
  updateLowStockAlerts: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { error } = await supabase
        .from('shops')
        .update({ low_stock_alerts: input.enabled })
        .eq('id', shop.id)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true, enabled: input.enabled }
    }),

  updateInvoiceSettings: protectedProcedure
    .input(z.object({
      invoice_prefix: z.string().optional().nullable(),
      invoice_counter: z.number().min(1).optional(),
      quotation_prefix: z.string().optional().nullable(),
      quotation_counter: z.number().min(1).optional(),
      terms_conditions: z.string().optional().nullable(),
      // Thermal printing (blueprint D3): paper width and the UPI QR
      // toggle live with the other invoice settings.
      thermal_width: z.union([z.literal(58), z.literal(80)]).optional(),
      print_upi_qr: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireOwner(supabase, user.id)

      const updatePayload: Record<string, any> = {}
      if (input.invoice_prefix !== undefined) updatePayload.invoice_prefix = input.invoice_prefix
      if (input.invoice_counter !== undefined) updatePayload.invoice_counter = input.invoice_counter
      if (input.quotation_prefix !== undefined) updatePayload.quotation_prefix = input.quotation_prefix
      if (input.quotation_counter !== undefined) updatePayload.quotation_counter = input.quotation_counter
      if (input.terms_conditions !== undefined) updatePayload.terms_conditions = input.terms_conditions
      if (input.thermal_width !== undefined) updatePayload.thermal_width = input.thermal_width
      if (input.print_upi_qr !== undefined) updatePayload.print_upi_qr = input.print_upi_qr

      const { data, error } = await supabase
        .from('shops')
        .update(updatePayload)
        .eq('id', shop.id)
        .select()
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    })
})
