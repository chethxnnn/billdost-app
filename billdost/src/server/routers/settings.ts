import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireOwner, requireManagerOrOwner } from '../utils/auth'

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

  updateInvoiceSettings: protectedProcedure
    .input(z.object({
      invoice_prefix: z.string().optional().nullable(),
      invoice_counter: z.number().min(1).optional(),
      quotation_prefix: z.string().optional().nullable(),
      quotation_counter: z.number().min(1).optional(),
      terms_conditions: z.string().optional().nullable(),
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
