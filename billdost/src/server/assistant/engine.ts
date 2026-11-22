import type { SupabaseClient } from '@supabase/supabase-js'
import {
  matchIntent,
  periodLabel,
  periodRange,
  istDateString,
  istDayBoundsUtc,
  type MatchedIntent,
} from '@/lib/assistant/intents'
import {
  composeSales,
  composeTopItems,
  composeLowStock,
  composeUdhaar,
  composeTopDebtors,
  composeCustomerHistory,
  composeCustomerNotFound,
  composePaymentsToday,
  composeGst,
  composeInvoiceTrend,
  composeNavigate,
  cardToText,
  type AssistantCard,
} from '@/lib/assistant/answers'

/**
 * The deterministic half of the BillDost Assistant (Stage 7).
 *
 * matchIntent (pure, tested) decides whether the question is one of
 * the known daily questions. If yes, exactly one fixed, parameterized
 * query set runs here over the shop's own rows, through the caller's
 * RLS-scoped client, and the answer is composed from templates with
 * the exact figures. If no intent matches, or a query fails, this
 * returns null and the chat route falls through to the general AI
 * flow unchanged: coverage never regresses, and a number the engine
 * prints is always a number the database said.
 */
export interface EngineAnswer {
  intent: MatchedIntent
  card: AssistantCard
  text: string
  navigate?: { destination: string; label: string }
}

interface ShopLike {
  id: string
}

const num = (v: unknown): number => Number(v ?? 0) || 0

export async function answerWithEngine(
  supabase: SupabaseClient,
  shop: ShopLike,
  rawText: string,
  now: Date = new Date()
): Promise<EngineAnswer | null> {
  const intent = matchIntent(rawText)
  if (!intent) return null

  const todayIst = istDateString(now)
  const label = periodLabel(intent.period)
  const range = periodRange(intent.period, todayIst)

  try {
    switch (intent.kind) {
      case 'navigate': {
        const card = composeNavigate(intent.destinationLabel ?? 'Page')
        return {
          intent,
          card,
          text: cardToText(card),
          navigate: {
            destination: intent.destination!,
            label: intent.destinationLabel ?? 'Page',
          },
        }
      }

      case 'sales_summary':
      case 'invoice_trend': {
        const { data, error } = await supabase
          .from('invoices')
          .select('total, amount_paid')
          .eq('shop_id', shop.id)
          .eq('status', 'active')
          .gte('invoice_date', range.from)
          .lte('invoice_date', range.to)
        if (error || !data) return null
        const total = data.reduce((a, r) => a + num(r.total), 0)
        const paid = data.reduce((a, r) => a + num(r.amount_paid), 0)
        const card =
          intent.kind === 'sales_summary'
            ? composeSales(label, { count: data.length, total, paid })
            : composeInvoiceTrend(label, data.length, total)
        return { intent, card, text: cardToText(card) }
      }

      case 'top_items': {
        const { data, error } = await supabase
          .from('invoice_items')
          .select('name, quantity, total, invoices!inner(shop_id, status, invoice_date)')
          .eq('invoices.shop_id', shop.id)
          .eq('invoices.status', 'active')
          .gte('invoices.invoice_date', range.from)
          .lte('invoices.invoice_date', range.to)
        if (error || !data) return null
        const byName = new Map<string, { qty: number; total: number }>()
        for (const row of data) {
          const cur = byName.get(row.name) ?? { qty: 0, total: 0 }
          cur.qty += num(row.quantity)
          cur.total += num(row.total)
          byName.set(row.name, cur)
        }
        const items = [...byName.entries()]
          .map(([name, v]) => ({ name, qty: v.qty, total: v.total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
        const card = composeTopItems(label, items)
        return { intent, card, text: cardToText(card) }
      }

      case 'low_stock': {
        const { data, error } = await supabase
          .from('products')
          .select('name, stock_qty, low_stock_alert')
          .eq('shop_id', shop.id)
          .eq('is_active', true)
          .not('stock_qty', 'is', null)
          .order('stock_qty', { ascending: true })
          .limit(100)
        if (error || !data) return null
        const items = data
          .map((p) => ({
            name: p.name,
            stock: num(p.stock_qty),
            alert: p.low_stock_alert === null ? null : num(p.low_stock_alert),
          }))
          .filter((p) => p.stock <= (p.alert ?? 0))
          .slice(0, 10)
        const card = composeLowStock(items)
        return { intent, card, text: cardToText(card) }
      }

      case 'udhaar_total':
      case 'top_debtors': {
        const { data, error } = await supabase
          .from('invoices')
          .select('customer_name, balance_due')
          .eq('shop_id', shop.id)
          .eq('status', 'active')
          .in('payment_status', ['unpaid', 'partial'])
          .gt('balance_due', 0)
        if (error || !data) return null
        const total = data.reduce((a, r) => a + num(r.balance_due), 0)
        const byName = new Map<string, number>()
        for (const row of data) {
          const name = row.customer_name || 'Walk-in'
          byName.set(name, (byName.get(name) ?? 0) + num(row.balance_due))
        }
        const debtors = [...byName.entries()]
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
        const card =
          intent.kind === 'udhaar_total'
            ? composeUdhaar(total, debtors)
            : composeTopDebtors(total, debtors)
        return { intent, card, text: cardToText(card) }
      }

      case 'customer_history': {
        const query = intent.customerQuery ?? ''
        const { data: customers, error } = await supabase
          .from('customers')
          .select('id, name')
          .eq('shop_id', shop.id)
          .ilike('name', `%${query}%`)
          .limit(5)
        if (error) return null
        const customer =
          customers?.find((c) => c.name.toLowerCase() === query.toLowerCase()) ??
          customers?.[0]
        if (!customer) {
          const card = composeCustomerNotFound(query)
          return { intent, card, text: cardToText(card) }
        }
        const { data: invs, error: invError } = await supabase
          .from('invoices')
          .select('total, amount_paid, balance_due, invoice_date')
          .eq('shop_id', shop.id)
          .eq('customer_id', customer.id)
          .eq('status', 'active')
          .order('invoice_date', { ascending: false })
        if (invError || !invs) return null
        const card = composeCustomerHistory({
          name: customer.name,
          billed: invs.reduce((a, r) => a + num(r.total), 0),
          paid: invs.reduce((a, r) => a + num(r.amount_paid), 0),
          due: invs.reduce((a, r) => a + num(r.balance_due), 0),
          billCount: invs.length,
          lastBillDate: invs[0]?.invoice_date ?? null,
        })
        return { intent, card, text: cardToText(card) }
      }

      case 'payments_today': {
        const { fromIso, toIso } = istDayBoundsUtc(todayIst)
        const { data, error } = await supabase
          .from('payments')
          .select('amount, mode')
          .eq('shop_id', shop.id)
          .gte('created_at', fromIso)
          .lt('created_at', toIso)
        if (error || !data) return null
        const byMode = new Map<string, number>()
        for (const row of data) {
          byMode.set(row.mode, (byMode.get(row.mode) ?? 0) + num(row.amount))
        }
        const card = composePaymentsToday({
          total: data.reduce((a, r) => a + num(r.amount), 0),
          count: data.length,
          byMode: [...byMode.entries()]
            .map(([mode, amount]) => ({ mode, amount }))
            .sort((a, b) => b.amount - a.amount),
        })
        return { intent, card, text: cardToText(card) }
      }

      case 'gst_month': {
        const { data, error } = await supabase
          .from('invoices')
          .select('cgst_amt, sgst_amt, igst_amt')
          .eq('shop_id', shop.id)
          .eq('status', 'active')
          .gte('invoice_date', range.from)
          .lte('invoice_date', range.to)
        if (error || !data) return null
        const cgst = data.reduce((a, r) => a + num(r.cgst_amt), 0)
        const sgst = data.reduce((a, r) => a + num(r.sgst_amt), 0)
        const igst = data.reduce((a, r) => a + num(r.igst_amt), 0)
        const card = composeGst({
          total: cgst + sgst + igst,
          cgst,
          sgst,
          igst,
          billCount: data.length,
        })
        return { intent, card, text: cardToText(card) }
      }
    }
  } catch {
    return null
  }
  return null
}
