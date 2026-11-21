import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { calculateForecast } from '@/lib/analyticsMath'
import { requireManagerOrOwner } from '../utils/auth'

export const analyticsRouter = router({
  /**
   * overview - powers the 4 dashboard stat cards:
   *   • Today's revenue
   *   • Pending amount
   *   • Bills sent today
   *   • New customers this week
   */
  overview: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD

    // Start of current week (Monday)
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    // 2. Today's revenue (sum of paid invoices created today)
    const { data: todayRevData } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('shop_id', shop.id)
      .eq('invoice_date', todayStr)
      .in('payment_status', ['paid', 'partial'])

    const todayRevenue = (todayRevData ?? []).reduce(
      (sum, inv) => sum + Number(inv.amount_paid ?? 0),
      0
    )

    // 3. Total pending amount across all invoices
    const { data: pendingData } = await supabase
      .from('invoices')
      .select('balance_due')
      .eq('shop_id', shop.id)
      .in('payment_status', ['unpaid', 'partial'])

    const pendingAmount = (pendingData ?? []).reduce(
      (sum, inv) => sum + Number(inv.balance_due ?? 0),
      0
    )

    // 4. Bills sent today (all invoices created today)
    const { count: billsSentToday } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id)
      .eq('invoice_date', todayStr)

    // 5. New customers this week
    const { count: newCustomersThisWeek } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id)
      .gte('created_at', weekStartStr)

    return {
      shopId: shop.id,
      shopName: shop.name,
      shopCategory: shop.category,
      todayRevenue,
      pendingAmount,
      billsSentToday: billsSentToday ?? 0,
      newCustomersThisWeek: newCustomersThisWeek ?? 0,
    }
  }),

  /**
   * weeklyRevenue - 7 data points (Mon → Sun) for the mini bar chart
   */
  weeklyRevenue: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    // Build last 7 days for the chart, plus the 7 before them so the
    // dashboard can show a REAL growth figure (this period vs the
    // previous one) instead of a decorative number.
    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().split('T')[0])
    }
    const prevDays: string[] = []
    for (let i = 13; i >= 7; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      prevDays.push(d.toISOString().split('T')[0])
    }

    const startDate = prevDays[0]

    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_date, amount_paid')
      .eq('shop_id', shop.id)
      .gte('invoice_date', startDate)
      .in('payment_status', ['paid', 'partial'])

    // Group by date
    const revenueByDay: Record<string, number> = {}
    ;[...prevDays, ...days].forEach((d) => (revenueByDay[d] = 0))
    ;(invoices ?? []).forEach((inv) => {
      const d = inv.invoice_date
      if (d in revenueByDay) {
        revenueByDay[d] += Number(inv.amount_paid ?? 0)
      }
    })

    const prevWeekTotal = prevDays.reduce((acc, d) => acc + (revenueByDay[d] || 0), 0)

    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const todayDow = new Date().getDay() // 0 = Sun

    return {
      days: days.map((dateStr, idx) => {
        const d = new Date(dateStr)
        const dow = d.getDay()
        return {
          date: dateStr,
          label: DAY_LABELS[dow === 0 ? 6 : dow - 1],
          revenue: revenueByDay[dateStr],
          isToday: idx === 6,
        }
      }),
      prevWeekTotal,
    }
  }),

  /**
   * recentInvoices - last 5 invoices for the dashboard table
   */
  recentInvoices: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const limit = input?.limit ?? 5

      // Same resolver as every other procedure (blueprint C12): the old
      // owner-only lookup threw NOT_FOUND for every manager and cashier,
      // and the select carried the never-written wa_status column.
      // Delivery status now lives in whatsapp_sends, not on the invoice.
      const shop = await requireManagerOrOwner(supabase, user.id)

      const { data: invoices } = await supabase
        .from('invoices')
        .select(
          'id, invoice_number, customer_name, customer_phone, total, amount_paid, balance_due, payment_status, invoice_date'
        )
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      return invoices ?? []
    }),

  /**
   * recentActivity - last N activity log entries
   */
  recentActivity: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx
      const limit = input?.limit ?? 10

      const shop = await requireManagerOrOwner(supabase, user.id)

      const { data: activity } = await supabase
        .from('activity_log')
        .select('id, type, entity_type, entity_id, summary, created_at')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      return activity ?? []
    }),

  /**
   * revenueTrends - Monthly revenue for the last 6 months
   */
  revenueTrends: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx

    const shop = await requireManagerOrOwner(supabase, user.id)

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1) // Start of that month
    
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_date, amount_paid')
      .eq('shop_id', shop.id)
      .gte('invoice_date', sixMonthsAgo.toISOString().split('T')[0])
      .in('payment_status', ['paid', 'partial'])

    const monthlyMap: Record<string, number> = {}
    
    // Initialize the last 6 months to 0
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const monthStr = d.toLocaleString('en-US', { month: 'short' })
      monthlyMap[monthStr] = 0
    }

    ;(invoices ?? []).forEach(inv => {
      const d = new Date(inv.invoice_date)
      const monthStr = d.toLocaleString('en-US', { month: 'short' })
      if (monthStr in monthlyMap) {
        monthlyMap[monthStr] += Number(inv.amount_paid || 0)
      }
    })

    return Object.keys(monthlyMap).map(m => ({
      month: m,
      revenue: monthlyMap[m]
    }))
  }),

  /**
   * topProducts - Returns top 10 products by quantity sold
   */
  topProducts: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx

    const shop = await requireManagerOrOwner(supabase, user.id)

    // We fetch all invoice items joined with invoice to ensure shop_id matches,
    // but without an easy join on supabase client, we can do:
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id')
      .eq('shop_id', shop.id)

    if (!invoices || invoices.length === 0) return []
    const invoiceIds = invoices.map(i => i.id)

    const { data: items } = await supabase
      .from('invoice_items')
      .select('name, quantity, total')
      .in('invoice_id', invoiceIds)

    const prodMap: Record<string, { name: string, qty: number, revenue: number }> = {}

    ;(items ?? []).forEach(item => {
      const n = item.name
      if (!prodMap[n]) {
        prodMap[n] = { name: n, qty: 0, revenue: 0 }
      }
      prodMap[n].qty += Number(item.quantity)
      prodMap[n].revenue += Number(item.total)
    })

    const sorted = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    return sorted
  }),

  /**
   * topCustomers - Returns top 5 customers by revenue
   */
  topCustomers: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    const { data: customers } = await supabase
      .from('customers')
      .select('name, total_billed')
      .eq('shop_id', shop.id)
      .order('total_billed', { ascending: false })
      .limit(5)

    return customers ?? []
  }),

  /**
   * predictProductSales - Mathematical prediction model (SMA + Linear Trend)
   */
  predictProductSales: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    // Fetch invoices from last 60 days
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const startDate = sixtyDaysAgo.toISOString().split('T')[0]

    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_date')
      .eq('shop_id', shop.id)
      .gte('invoice_date', startDate)

    if (!invoices || invoices.length === 0) return []

    const invoiceIds = invoices.map(i => i.id)
    
    // Create a map of invoice ID -> date for quick lookup
    const invoiceDates: Record<string, string> = {}
    invoices.forEach(i => { invoiceDates[i.id] = i.invoice_date })

    // Fetch items for these invoices
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, name, quantity')
      .in('invoice_id', invoiceIds)

    if (!items || items.length === 0) return []

    // Group sales into 4 periods of 15 days each (P1=oldest, P4=newest)
    const now = new Date()
    const p1Date = new Date(now).setDate(now.getDate() - 60)
    const p2Date = new Date(now).setDate(now.getDate() - 45)
    const p3Date = new Date(now).setDate(now.getDate() - 30)
    const p4Date = new Date(now).setDate(now.getDate() - 15)

    const prodStats: Record<string, [number, number, number, number]> = {}

    items.forEach(item => {
      const n = item.name
      if (!prodStats[n]) prodStats[n] = [0, 0, 0, 0]
      
      const invDate = new Date(invoiceDates[item.invoice_id!]).getTime()
      const qty = Number(item.quantity || 0)

      if (invDate >= p4Date) prodStats[n][3] += qty
      else if (invDate >= p3Date) prodStats[n][2] += qty
      else if (invDate >= p2Date) prodStats[n][1] += qty
      else prodStats[n][0] += qty
    })

    return calculateForecast(prodStats)
  }),

  /**
   * Monthly cash snapshot (blueprint D11): money actually received
   * this month from the payments ledger minus this month's active
   * expenses. Labelled a cash view everywhere it is shown: it is not
   * accrual profit (credit sales count when paid, stock purchases
   * are not in expenses unless the shop records them).
   */
  monthlyProfit: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const shop = await requireManagerOrOwner(supabase, user.id)

    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthStartIso = monthStart.toISOString()
    const monthStartDate = monthStartIso.split('T')[0]

    const [{ data: payments, error: payErr }, { data: expenses, error: expErr }] =
      await Promise.all([
        supabase
          .from('payments')
          .select('amount')
          .eq('shop_id', shop.id)
          .gte('created_at', monthStartIso),
        supabase
          .from('expenses')
          .select('amount')
          .eq('shop_id', shop.id)
          .eq('status', 'active')
          .gte('expense_date', monthStartDate),
      ])
    if (payErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: payErr.message })
    if (expErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: expErr.message })

    const received = (payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const spent = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
    return {
      month: monthStartDate.slice(0, 7),
      received,
      expenses: spent,
      net: received - spent,
      basis: 'cash' as const,
    }
  })
})
