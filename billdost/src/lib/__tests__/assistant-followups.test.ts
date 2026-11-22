import { describe, it, expect } from 'vitest'
import { QUICK_CHIPS, COMMAND_GROUPS, followUpsFor } from '@/lib/assistant/followups'
import { matchIntent } from '@/lib/assistant/intents'

// The discoverability catalogue is a promise: everything it tells
// the shopkeeper to ask must actually be understood by the
// deterministic engine. These tests hold that promise by running
// every example through the real matcher.
describe('QUICK_CHIPS', () => {
  it('has the seven everyday questions', () => {
    expect(QUICK_CHIPS).toHaveLength(7)
  })

  it('every chip matches a deterministic intent', () => {
    for (const chip of QUICK_CHIPS) {
      expect(matchIntent(chip), chip).not.toBeNull()
    }
  })
})

describe('COMMAND_GROUPS', () => {
  it('covers Sales, Stock, Udhaar, Customers and Navigation', () => {
    expect(COMMAND_GROUPS.map((g) => g.title)).toEqual([
      'Sales',
      'Stock',
      'Udhaar',
      'Customers',
      'Navigation',
    ])
  })

  it('every group has 3 to 6 examples', () => {
    for (const group of COMMAND_GROUPS) {
      expect(group.examples.length, group.title).toBeGreaterThanOrEqual(3)
      expect(group.examples.length, group.title).toBeLessThanOrEqual(6)
    }
  })

  it('every send example is understood by the engine', () => {
    for (const group of COMMAND_GROUPS) {
      for (const ex of group.examples) {
        if (ex.action !== 'send') continue
        expect(matchIntent(ex.text), `${group.title}: ${ex.text}`).not.toBeNull()
      }
    }
  })

  it('customer examples fill the composer and resolve to customer_history once a name is in', () => {
    const customers = COMMAND_GROUPS.find((g) => g.title === 'Customers')
    expect(customers).toBeTruthy()
    for (const ex of customers!.examples) {
      expect(ex.action).toBe('fill')
      expect(matchIntent(ex.text)?.kind, ex.text).toBe('customer_history')
    }
  })

  it('navigation examples resolve to navigate intents with destinations', () => {
    const nav = COMMAND_GROUPS.find((g) => g.title === 'Navigation')
    for (const ex of nav!.examples) {
      const m = matchIntent(ex.text)
      expect(m?.kind, ex.text).toBe('navigate')
      expect(m?.destination, ex.text).toBeTruthy()
    }
  })
})

describe('followUpsFor', () => {
  it('gives 2 to 3 follow-ups for data intents', () => {
    for (const kind of [
      'sales_summary',
      'top_items',
      'low_stock',
      'udhaar_total',
      'top_debtors',
      'customer_history',
      'payments_today',
      'gst_month',
      'invoice_trend',
    ]) {
      const ups = followUpsFor(kind)
      expect(ups.length, kind).toBeGreaterThanOrEqual(2)
      expect(ups.length, kind).toBeLessThanOrEqual(3)
    }
  })

  it('every follow-up chip is itself understood by the engine', () => {
    for (const kind of Object.keys({
      sales_summary: 1,
      top_items: 1,
      low_stock: 1,
      udhaar_total: 1,
      top_debtors: 1,
      customer_history: 1,
      payments_today: 1,
      gst_month: 1,
      invoice_trend: 1,
    })) {
      for (const chip of followUpsFor(kind)) {
        expect(matchIntent(chip), `${kind} -> ${chip}`).not.toBeNull()
      }
    }
  })

  it('returns nothing for navigate, unknown or missing intents', () => {
    expect(followUpsFor('navigate')).toEqual([])
    expect(followUpsFor('something-else')).toEqual([])
    expect(followUpsFor(undefined)).toEqual([])
    expect(followUpsFor(null)).toEqual([])
  })
})
