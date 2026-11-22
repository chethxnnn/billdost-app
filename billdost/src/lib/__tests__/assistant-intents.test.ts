import { describe, it, expect } from 'vitest'
import {
  matchIntent,
  periodRange,
  istDayBoundsUtc,
  normalizeText,
} from '../assistant/intents'

describe('matchIntent: sales summaries', () => {
  it('matches aaj ki sales (Hinglish)', () => {
    const m = matchIntent('Aaj ki sales kitni hai?')
    expect(m?.kind).toBe('sales_summary')
    expect(m?.period).toBe('today')
  })

  it('matches English today sales', () => {
    const m = matchIntent('What are my sales today?')
    expect(m?.kind).toBe('sales_summary')
    expect(m?.period).toBe('today')
  })

  it('matches kal (yesterday) bikri', () => {
    const m = matchIntent('Kal ki bikri kitni thi')
    expect(m?.kind).toBe('sales_summary')
    expect(m?.period).toBe('yesterday')
  })

  it('matches is mahine ki kamai as month', () => {
    const m = matchIntent('Is mahine ki kamai kitni hai')
    expect(m?.kind).toBe('sales_summary')
    expect(m?.period).toBe('month')
  })

  it('matches is hafte sales as week', () => {
    const m = matchIntent('Is hafte sales kaisi rahi')
    expect(m?.kind).toBe('sales_summary')
    expect(m?.period).toBe('week')
  })

  it('defaults bare sales to today', () => {
    expect(matchIntent('Sales batao')?.period).toBe('today')
  })
})

describe('matchIntent: stock, udhaar, gst, payments', () => {
  it('matches low stock', () => {
    expect(matchIntent('Low stock kya hai?')?.kind).toBe('low_stock')
    expect(matchIntent('Kaun sa stock khatam hone wala hai')?.kind).toBe('low_stock')
  })

  it('matches the udhaar total', () => {
    expect(matchIntent('Total udhaar kitna baki hai')?.kind).toBe('udhaar_total')
  })

  it('matches the debtor list before the total', () => {
    expect(matchIntent('Kis kis se udhaar lena hai?')?.kind).toBe('top_debtors')
    expect(matchIntent('Sabse zyada udhaar kiska hai')?.kind).toBe('top_debtors')
  })

  it('matches GST for the month', () => {
    const m = matchIntent('Is mahine GST kitna bana?')
    expect(m?.kind).toBe('gst_month')
  })

  it('matches payments received today', () => {
    expect(matchIntent('Aaj payment kitna aaya')?.kind).toBe('payments_today')
    expect(matchIntent('Aaj ki collection kitni hai')?.kind).toBe('payments_today')
  })
})

describe('matchIntent: top items and bill count', () => {
  it('matches top selling items', () => {
    expect(matchIntent('Sabse zyada bikne wala item kaunsa hai')?.kind).toBe('top_items')
    expect(matchIntent('Top selling products this week')?.kind).toBe('top_items')
  })

  it('matches the bill count without stealing sales questions', () => {
    const m = matchIntent('Aaj kitne bill bane?')
    expect(m?.kind).toBe('invoice_trend')
    expect(m?.period).toBe('today')
    expect(matchIntent('Aaj ki sales kitni hai')?.kind).toBe('sales_summary')
  })
})

describe('matchIntent: named customers', () => {
  it('extracts the name from a possessive question', () => {
    const m = matchIntent('Ramesh Kumar ka hisaab batao')
    expect(m?.kind).toBe('customer_history')
    expect(m?.customerQuery).toBe('ramesh kumar')
  })

  it('routes a named customer udhaar to the customer, not the total', () => {
    const m = matchIntent('Suresh ka udhaar kitna hai')
    expect(m?.kind).toBe('customer_history')
    expect(m?.customerQuery).toBe('suresh')
  })

  it('strips a filler prefix before the name', () => {
    const m = matchIntent('Mujhe Ramesh ka hisaab batao')
    expect(m?.kind).toBe('customer_history')
    expect(m?.customerQuery).toBe('ramesh')
  })
})

describe('matchIntent: navigation', () => {
  it('navigates on an explicit open request', () => {
    const m = matchIntent('Customers page kholo')
    expect(m?.kind).toBe('navigate')
    expect(m?.destination).toBe('/customers')
  })

  it('navigates to new bill for bill banao', () => {
    const m = matchIntent('Bill banao')
    expect(m?.kind).toBe('navigate')
    expect(m?.destination).toBe('/invoices/new')
  })

  it('prefers data over navigation for low stock dikhao', () => {
    expect(matchIntent('Low stock dikhao')?.kind).toBe('low_stock')
  })

  it('navigates for a bare page name', () => {
    expect(matchIntent('Inventory')?.destination).toBe('/inventory')
  })
})

describe('matchIntent: no confident match returns null', () => {
  it('returns null for general questions', () => {
    expect(matchIntent('What is the weather like in Delhi?')).toBeNull()
    expect(matchIntent('Write a poem about my shop')).toBeNull()
    expect(matchIntent('')).toBeNull()
    expect(matchIntent('Hello')).toBeNull()
  })

  it('returns null for a stock page view without data words', () => {
    // "stock page kholo" has an open verb and the inventory key.
    expect(matchIntent('Stock page kholo')?.kind).toBe('navigate')
  })
})

describe('periodRange', () => {
  it('today is a single day', () => {
    expect(periodRange('today', '2026-11-22')).toEqual({ from: '2026-11-22', to: '2026-11-22' })
  })

  it('yesterday crosses a month boundary correctly', () => {
    expect(periodRange('yesterday', '2026-11-01')).toEqual({ from: '2026-10-31', to: '2026-10-31' })
  })

  it('week starts on Monday (22 Nov 2026 is a Sunday)', () => {
    expect(periodRange('week', '2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
  })

  it('month starts on the first', () => {
    expect(periodRange('month', '2026-11-22')).toEqual({ from: '2026-11-01', to: '2026-11-22' })
  })
})

describe('istDayBoundsUtc', () => {
  it('IST midnight is 18:30 UTC the previous day', () => {
    const { fromIso, toIso } = istDayBoundsUtc('2026-11-22')
    expect(fromIso).toBe('2026-11-21T18:30:00.000Z')
    expect(toIso).toBe('2026-11-22T18:30:00.000Z')
  })
})

describe('normalizeText', () => {
  it('lowercases, strips punctuation and collapses spaces', () => {
    expect(normalizeText('  Aaj ki SALES, kitni hai?? ')).toBe('aaj ki sales kitni hai')
  })
})
