import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { requireShopAccess } from '../utils/auth'
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'

const extractedProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  category: z.string().optional().nullable(),
  unit: z.enum(['piece', 'kg', 'g', 'litre', 'ml', 'dozen', 'pack', 'service', 'hour']).default('piece'),
})

export const aiRouter = router({
  /* ─────────────────────────────────────────
     EXTRACT FROM URL
  ───────────────────────────────────────── */
  extractFromUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      await requireShopAccess(supabase, user.id)

      try {
        const res = await fetch(input.url)
        if (!res.ok) throw new Error(`Failed to fetch URL: ${res.statusText}`)
        
        const html = await res.text()
        
        // Very basic strip of HTML to save tokens
        const textContent = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 15000) // limit size just in case

        const { object } = await generateObject({
          model: google('gemini-2.0-flash'),
          schema: z.object({
            products: z.array(extractedProductSchema),
          }),
          prompt: `Extract all products from this website text. Find the product name, price, and guess a reasonable category and unit. Website text: ${textContent}`,
        })

        return object.products
      } catch (err: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `AI Extraction failed: ${err.message}` })
      }
    }),

  /* ─────────────────────────────────────────
     EXTRACT FROM IMAGE (Base64)
  ───────────────────────────────────────── */
  extractFromImage: protectedProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      await requireShopAccess(supabase, user.id)

      try {
        const { object } = await generateObject({
          model: google('gemini-2.0-flash'), // Flash is fast and excellent at OCR
          schema: z.object({
            products: z.array(extractedProductSchema),
          }),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract all products, menu items, or catalog entries from this image. Output the name, price, category, and standard unit. If no price is found, use 0.' },
                { type: 'image', image: input.base64 },
              ],
            },
          ],
        })

        return object.products
      } catch (err: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `AI Image Extraction failed: ${err.message}` })
      }
    }),
})
