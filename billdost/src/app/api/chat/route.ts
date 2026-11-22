import { google } from '@ai-sdk/google'
import { streamText, tool, convertToModelMessages, stepCountIs, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireShopAccess } from '@/server/utils/auth'
import { answerWithEngine } from '@/server/assistant/engine'

export const maxDuration = 30

export async function POST(req: Request) {
  let messages: UIMessage[]
  try {
    const body = await req.json()
    messages = Array.isArray(body?.messages) ? body.messages : []
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  // Authenticate user and get shop ID
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let shop
  try {
    shop = await requireShopAccess(supabase, user.id)
  } catch (err) {
    return new Response('Shop access denied', { status: 403 })
  }

  const validMessages = messages.filter(
    (m) => m && typeof m.role === 'string' && Array.isArray(m.parts) && m.parts.length > 0
  )

  // Deterministic intent engine first (Stage 7): the known daily
  // questions (aaj ki sales, low stock, udhaar, GST...) are answered
  // from fixed queries over the shop's real data, composed from
  // templates, with no model in the loop. Only when the engine has
  // no confident match does the request fall through to the Gemini
  // tool-calling flow below, unchanged.
  const lastUserMessage = [...validMessages].reverse().find((m) => m.role === 'user')
  const lastUserText = (lastUserMessage?.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text?: string }).text ?? '')
    .join(' ')
    .trim()

  if (lastUserText) {
    const engineAnswer = await answerWithEngine(supabase, shop, lastUserText)
    if (engineAnswer) {
      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: 'start' })
          writer.write({
            type: 'data-assistant-card',
            data: {
              intent: engineAnswer.intent.kind,
              headline: engineAnswer.card.headline,
              lines: engineAnswer.card.lines,
              note: engineAnswer.card.note,
            },
          })
          if (engineAnswer.navigate) {
            writer.write({
              type: 'data-navigate',
              data: {
                destination: engineAnswer.navigate.destination,
                label: engineAnswer.navigate.label,
              },
            })
          }
          const textId = 'engine-text'
          writer.write({ type: 'text-start', id: textId })
          writer.write({ type: 'text-delta', id: textId, delta: engineAnswer.text })
          writer.write({ type: 'text-end', id: textId })
          writer.write({ type: 'finish' })
        },
      })
      return createUIMessageStreamResponse({ stream })
    }
  }

  const coreMessages = await convertToModelMessages(validMessages)

  const result = await streamText({
    model: google('gemini-2.0-flash'),
    system: `You are BillDost Assistant, a specialized AI for shop owners using the BillDost POS system.
CRITICAL RULES:
1. YOU MUST STRICTLY REFUSE TO ANSWER ANY QUESTION THAT IS NOT RELATED TO BILLDOST, THE USER'S SHOP DATA, OR BUSINESS MANAGEMENT. If asked about general knowledge, coding, history, or anything off-topic, reply: "I can only answer questions related to your BillDost shop data."
2. ALWAYS use your tools to fetch real data from Supabase before answering questions about sales, invoices, customers, or inventory. NEVER invent or hallucinate data.
3. Be concise and professional.
4. If the user wants to navigate somewhere, use the navigateApp tool.`,
    messages: coreMessages,
    stopWhen: stepCountIs(5),

    tools: {
      getShopStats: tool({
        description: 'Get high-level statistics about the shop like total revenue, total customers, and pending payments.',
        inputSchema: z.object({}),
        execute: async () => {
          // Active bills only: the document status column is real
          // (migration 0003) and cancelled bills are excluded on
          // purpose. Errors are returned to the model, never silently
          // read as zeros (blueprint C11).
          const { data: invoices, error } = await supabase
            .from('invoices')
            .select('total, amount_paid, balance_due, payment_status')
            .eq('shop_id', shop.id)
            .eq('status', 'active')

          if (error) {
            return { error: 'Shop data could not be loaded right now.' }
          }

          const { count: customersCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shop.id)

          const rows = invoices ?? []
          // Billed is what was charged; revenue is what was actually
          // received. Pending is the balance still owed, not the full
          // totals of unpaid bills.
          const totalBilled = rows.reduce((acc, inv) => acc + Number(inv.total), 0)
          const totalRevenue = rows.reduce((acc, inv) => acc + Number(inv.amount_paid), 0)
          const pendingAmount = rows
            .filter((i) => i.payment_status === 'unpaid' || i.payment_status === 'partial')
            .reduce((acc, inv) => acc + Number(inv.balance_due), 0)

          return {
            totalRevenue,
            totalBilled,
            pendingPayments: pendingAmount,
            totalCustomers: customersCount || 0
          }
        },
      }),
      getInvoices: tool({
        description: 'Fetch recent invoices. Can optionally filter by limit.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Number of invoices to return, defaults to 5'),
          status: z.string().optional().describe('Filter by payment status: paid, unpaid, partial'),
        }),
        execute: async ({ limit = 5, status }: { limit?: number; status?: string }) => {
          let query = supabase
            .from('invoices')
            .select('id, invoice_number, customer_name, total, payment_status, invoice_date')
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false })
            .limit(limit)

          if (status) {
            query = query.eq('payment_status', status)
          }

          const { data, error } = await query
          if (error) throw new Error(error.message)
          return data
        },
      }),
      getCustomers: tool({
        description: 'Search for customers by name or phone number.',
        inputSchema: z.object({
          searchQuery: z.string().optional().describe('Name or phone number to search for'),
        }),
        execute: async ({ searchQuery }: { searchQuery?: string }) => {
          let query = supabase
            .from('customers')
            .select('id, name, phone, address, total_billed')
            .eq('shop_id', shop.id)
            .limit(5)

          if (searchQuery) {
            query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
          }

          const { data, error } = await query
          if (error) throw new Error(error.message)
          return data
        },
      }),
      getProducts: tool({
        description: 'Fetch the shop\'s product catalog/inventory. Useful for checking stock, low stock items, prices, or finding specific items.',
        inputSchema: z.object({
          searchQuery: z.string().optional().describe('Name of product to search for'),
          lowStockOnly: z.boolean().optional().describe('If true, only returns products where stock_qty is less than or equal to low_stock_alert'),
        }),
        execute: async ({ searchQuery, lowStockOnly }: { searchQuery?: string; lowStockOnly?: boolean }) => {
          let query = supabase
            .from('products')
            .select('id, name, price, stock_qty, low_stock_alert, category')
            .eq('shop_id', shop.id)
            .limit(10)

          if (searchQuery) {
            query = query.ilike('name', `%${searchQuery}%`)
          }

          const { data, error } = await query
          if (error) throw new Error(error.message)

          if (lowStockOnly && data) {
            return data.filter((p) => (p.stock_qty ?? 0) <= (p.low_stock_alert || 0))
          }
          return data
        },
      }),
      navigateApp: tool({
        description: 'Tells the frontend to navigate the user to a specific page in the app. Call this when the user asks to "go to", "open", "create", or "show me" a page.',
        inputSchema: z.object({
          destination: z.enum([
            '/dashboard',
            '/invoices',
            '/invoices/new',
            '/customers',
            '/catalog',
            '/settings'
          ]).describe('The route to navigate to. E.g., for "create invoice" use /invoices/new'),
        }),
        execute: async ({ destination }: { destination: string }) => {
          // Returning this tells the frontend to perform the navigation
          return { command: 'NAVIGATE', destination }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
