import { google } from '@ai-sdk/google'
import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireShopAccess } from '@/server/utils/auth'

export async function POST(req: Request) {
  const { messages } = await req.json()

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
    (m: any) => m.role && (typeof m.content === 'string' || Array.isArray(m.content) || Array.isArray(m.parts))
  )

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

    tools: {
      getShopStats: tool({
        description: 'Get high-level statistics about the shop like total revenue, total customers, and pending payments.',
        parameters: z.object({}),
        execute: async () => {
          // Fetch real stats
          const { data: invoices } = await supabase
            .from('invoices')
            .select('total, payment_status')
            .eq('shop_id', shop.id)
            .neq('status', 'cancelled')

          const { count: customersCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shop.id)

          const totalRevenue = invoices?.reduce((acc, inv) => acc + Number(inv.total), 0) || 0
          const pendingAmount = invoices?.filter(i => i.payment_status === 'unpaid' || i.payment_status === 'partial')
            .reduce((acc, inv) => acc + Number(inv.total), 0) || 0

          return {
            totalRevenue,
            pendingPayments: pendingAmount,
            totalCustomers: customersCount || 0
          }
        },
      }),
      getInvoices: tool({
        description: 'Fetch recent invoices. Can optionally filter by limit.',
        parameters: z.object({
          limit: z.number().optional().describe('Number of invoices to return, defaults to 5'),
          status: z.string().optional().describe('Filter by payment status: paid, unpaid, partial'),
        }),
        execute: async ({ limit = 5, status }) => {
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
        parameters: z.object({
          searchQuery: z.string().optional().describe('Name or phone number to search for'),
        }),
        execute: async ({ searchQuery }) => {
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
        parameters: z.object({
          searchQuery: z.string().optional().describe('Name of product to search for'),
          lowStockOnly: z.boolean().optional().describe('If true, only returns products where stock_qty is less than or equal to low_stock_alert'),
        }),
        execute: async ({ searchQuery, lowStockOnly }) => {
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
            return data.filter(p => p.stock_qty <= (p.low_stock_alert || 0))
          }
          return data
        },
      }),
      navigateApp: tool({
        description: 'Tells the frontend to navigate the user to a specific page in the app. Call this when the user asks to "go to", "open", "create", or "show me" a page.',
        parameters: z.object({
          destination: z.enum([
            '/dashboard',
            '/invoices',
            '/invoices/new',
            '/customers',
            '/catalog',
            '/settings'
          ]).describe('The route to navigate to. E.g., for "create invoice" use /invoices/new'),
        }),
        execute: async ({ destination }) => {
          // Returning this tells the frontend to perform the navigation
          return { command: 'NAVIGATE', destination }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
