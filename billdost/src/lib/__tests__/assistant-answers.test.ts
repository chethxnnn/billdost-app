import { describe, it, expect } from 'vitest'
import {
  formatRs,
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
  cardToText,
} from '../assistant/answers'

describe('formatRs', () => {
  it('uses Indian grouping', () => {
    expect(formatRs(5320)).toBe('₹5,320')
    expect(formatRs(123456)).toBe('₹1,23,456')
    expect(formatRs(10000000)).toBe('₹1,00,00,000')
  })

  it('keeps paise only when present', () => {
    expect(formatRs(100)).toBe('₹100')
    expect(formatRs(100.5)).toBe('₹100.50')
    expect(formatRs(0)).toBe('₹0')
  })
})

describe('composeSales', () => {
  it('composes headline, count and paid lines from fixtures', () => {
    const card = composeSales('Aaj', { count: 12, total: 5320, paid: 4000 })
    expect(card.headline).toBe('₹5,320')
    expect(card.lines[0]).toContain('12 bill')
    expect(card.lines[0]).toContain('₹5,320')
    expect(card.lines[1]).toContain('₹4,000')
    expect(card.lines[2]).toContain('₹1,320')
    expect(card.note).toBe('Aapke shop data se')
  })

  it('handles a zero day calmly', () => {
    const card = composeSales('Aaj', { count: 0, total: 0, paid: 0 })
    expect(card.headline).toBe('₹0')
    expect(card.lines[0]).toContain('koi bill nahi bana')
  })

  it('omits the due line when everything is paid', () => {
    const card = composeSales('Kal', { count: 3, total: 900, paid: 900 })
    expect(card.lines).toHaveLength(2)
  })
})

describe('composeTopItems and composeLowStock', () => {
  it('ranks items with quantities and amounts', () => {
    const card = composeTopItems('Is hafte', [
      { name: 'Aata 10kg', qty: 24, total: 9600 },
      { name: 'Chini 1kg', qty: 40, total: 1800 },
    ])
    expect(card.headline).toBe('Aata 10kg')
    expect(card.lines[1]).toContain('1. Aata 10kg: 24 bika, ₹9,600')
    expect(card.lines[2]).toContain('2. Chini 1kg: 40 bika, ₹1,800')
  })

  it('says stock is fine when nothing is low', () => {
    expect(composeLowStock([]).headline).toBe('Stock theek hai')
  })

  it('flags an empty shelf as khatam', () => {
    const card = composeLowStock([{ name: 'Tel 1L', stock: 0, alert: 5 }])
    expect(card.lines[0]).toBe('Tel 1L: stock khatam')
  })
})

describe('composeUdhaar and composeTopDebtors', () => {
  it('totals with the top names', () => {
    const card = composeUdhaar(12500, [{ name: 'Ramesh', amount: 8000 }])
    expect(card.headline).toBe('₹12,500')
    expect(card.lines[1]).toBe('Ramesh: ₹8,000')
  })

  it('lists debtors in order', () => {
    const card = composeTopDebtors(12500, [
      { name: 'Ramesh', amount: 8000 },
      { name: 'Suresh', amount: 4500 },
    ])
    expect(card.lines[1]).toContain('1. Ramesh')
    expect(card.lines[2]).toContain('2. Suresh')
  })

  it('celebrates a clear book', () => {
    expect(composeUdhaar(0, []).lines[0]).toContain('Sab clear hai')
  })
})

describe('composeCustomerHistory', () => {
  it('shows billed, paid, due and the last bill', () => {
    const card = composeCustomerHistory({
      name: 'Ramesh Kumar',
      billed: 20000,
      paid: 15500,
      due: 4500,
      billCount: 7,
      lastBillDate: '2026-11-20',
    })
    expect(card.headline).toBe('Ramesh Kumar')
    expect(card.lines[0]).toContain('₹20,000')
    expect(card.lines[2]).toContain('₹4,500')
    expect(card.lines[3]).toContain('2026-11-20')
  })

  it('reports a missing customer plainly', () => {
    const card = composeCustomerNotFound('xyz')
    expect(card.headline).toBe('Customer nahi mila')
    expect(card.lines[0]).toContain('xyz')
  })
})

describe('composePaymentsToday, composeGst, composeInvoiceTrend', () => {
  it('breaks payments down by mode', () => {
    const card = composePaymentsToday({
      total: 7300,
      count: 9,
      byMode: [
        { mode: 'upi', amount: 5000 },
        { mode: 'cash', amount: 2300 },
      ],
    })
    expect(card.headline).toBe('₹7,300')
    expect(card.lines[1]).toBe('UPI: ₹5,000')
    expect(card.lines[2]).toBe('Cash: ₹2,300')
  })

  it('splits GST into CGST, SGST and IGST lines', () => {
    const card = composeGst({ total: 1800, cgst: 700, sgst: 700, igst: 400, billCount: 30 })
    expect(card.headline).toBe('₹1,800')
    expect(card.lines[1]).toContain('CGST: ₹700')
    expect(card.lines[2]).toContain('IGST: ₹400')
  })

  it('counts bills for the trend card', () => {
    const card = composeInvoiceTrend('Aaj', 14, 9100)
    expect(card.headline).toBe('14 bill')
    expect(card.lines[0]).toContain('₹9,100')
  })
})

describe('cardToText', () => {
  it('renders headline then lines', () => {
    const card = composeSales('Aaj', { count: 1, total: 100, paid: 100 })
    expect(cardToText(card).startsWith('₹100\n')).toBe(true)
  })
})
