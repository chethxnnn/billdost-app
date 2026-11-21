import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { GSTIN_REGEX } from '@/lib/money'

/**
 * Onboarding completion (blueprint C13): the wizard's writes used to be
 * four separate browser-to-PostgREST inserts. They now go through this
 * one validated mutation into complete_onboarding_tx (migration 0014),
 * which creates the shop, the owner staff row, invited staff, starter
 * products and the activity log in a single transaction.
 *
 * File uploads (logo, UPI QR) stay client-side against the storage
 * buckets and happen BEFORE this call; only their public URLs arrive
 * here. The wizard's PIN is deliberately not in the schema: PINs are
 * never stored (blueprint B.9).
 */

const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 0 || (v.length >= 10 && v.length <= 13), {
    message: 'Phone number sahi nahi hai',
  })

const gstinSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => v === '' || GSTIN_REGEX.test(v), { message: 'GSTIN format galat hai' })

const upiSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[\w.\-]{2,}@[a-zA-Z]{2,}/.test(v), {
    message: 'UPI ID format galat hai (jaise dukaan@okhdfc)',
  })

export const onboardingRouter = router({
  completeOnboarding: protectedProcedure
    .input(
      z.object({
        shop_name: z.string().trim().min(1, 'Dukaan ka naam zaroori hai').max(120),
        category: z.string().trim().max(40).default('other'),
        gstin: gstinSchema.optional().nullable(),
        upi_id: upiSchema.optional().nullable(),
        upi_qr_url: z.string().max(600).optional().nullable(),
        logo_url: z.string().max(600).optional().nullable(),
        include_upi_qr: z.boolean().default(true),
        language: z.enum(['hinglish', 'en', 'hi', 'kn']).default('hinglish'),
        products: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(120),
              price: z.number().min(0),
              unit: z.string().trim().max(20).default('piece'),
              category: z.string().trim().max(60).optional().nullable(),
            })
          )
          .max(500)
          .default([]),
        staff: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(80),
              phone: phoneSchema,
              role: z.string().trim().max(20).default('cashier'),
            })
          )
          .max(20)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx

      // Same slug shape the wizard used to build in the browser,
      // now computed server-side so it cannot be spoofed or collide
      // with a hand-crafted payload.
      const slug =
        input.shop_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') +
        '-' +
        Date.now().toString(36)

      const payload = {
        shop_name: input.shop_name,
        slug,
        category: input.category || 'other',
        gstin: input.gstin || null,
        upi_id: input.upi_id || null,
        upi_qr_url: input.upi_qr_url || null,
        logo_url: input.logo_url || null,
        include_upi_qr: input.include_upi_qr,
        language: input.language,
        products: input.products,
        staff: input.staff,
      }

      const { data, error } = await supabase.rpc('complete_onboarding_tx', {
        p_payload: payload,
      })

      if (error) {
        if (error.message.includes('already_onboarded')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Aapki dukaan pehle se bani hui hai. Dashboard par chalo!',
          })
        }
        if (error.message.includes('not_authenticated')) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Login phir se karo.' })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }

      return { shop_id: data as string }
    }),
})
