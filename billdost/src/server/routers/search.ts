import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { requireShopAccess } from '../utils/auth'
import { ilikePattern } from '@/lib/search'

/**
 * Global search for the Topbar (blueprint C13): one shop-scoped query
 * across invoices (by number and by customer name), customers (name
 * and phone) and products (name). User input is escaped before it goes
 * anywhere near an ilike pattern, and each column is queried with its
 * own parameterised .ilike() call, never an interpolated .or() string.
 */
export const searchRouter = router({
  global: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(60) }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const shop = await requireShopAccess(supabase, user.id)
      const pattern = ilikePattern(input.q)

      const [invByNumber, invByCustomer, custByName, custByPhone, products] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, customer_name, total')
          .eq('shop_id', shop.id)
          .eq('status', 'active')
          .ilike('invoice_number', pattern)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('invoices')
          .select('id, invoice_number, customer_name, total')
          .eq('shop_id', shop.id)
          .eq('status', 'active')
          .ilike('customer_name', pattern)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('customers')
          .select('id, name, phone')
          .eq('shop_id', shop.id)
          .ilike('name', pattern)
          .order('name')
          .limit(5),
        supabase
          .from('customers')
          .select('id, name, phone')
          .eq('shop_id', shop.id)
          .ilike('phone', pattern)
          .order('name')
          .limit(5),
        supabase
          .from('products')
          .select('id, name, price')
          .eq('shop_id', shop.id)
          .eq('is_active', true)
          .ilike('name', pattern)
          .order('name')
          .limit(5),
      ])

      const invoiceMap = new Map<string, { id: string; invoice_number: string; customer_name: string; total: number }>()
      for (const row of [...(invByNumber.data ?? []), ...(invByCustomer.data ?? [])]) {
        if (!invoiceMap.has(row.id)) invoiceMap.set(row.id, row as any)
      }

      const customerMap = new Map<string, { id: string; name: string; phone: string | null }>()
      for (const row of [...(custByName.data ?? []), ...(custByPhone.data ?? [])]) {
        if (!customerMap.has(row.id)) customerMap.set(row.id, row as any)
      }

      return {
        invoices: Array.from(invoiceMap.values()).slice(0, 5),
        customers: Array.from(customerMap.values()).slice(0, 5),
        products: (products.data ?? []) as Array<{ id: string; name: string; price: number }>,
      }
    }),
})
