/**
 * Answer composition for the BillDost Assistant (Stage 7).
 *
 * Templates, not generation: every figure in an answer comes from a
 * fixed query over the shop's own data, formatted here with Indian
 * number grouping. Pure functions over fixture-shaped data, fully
 * unit tested. The card shape is what the assistant panel renders:
 * one headline figure, a few supporting lines, and the provenance
 * note, so the shopkeeper always knows the number is his own data
 * talking, not a guess.
 */

export interface AssistantCard {
  headline: string
  lines: string[]
  note: string
}

const NOTE = 'Aapke shop data se'

/** Rupees with Indian grouping: 1,23,456. Whole rupees stay whole. */
export function formatRs(value: number): string {
  const n = Number(value) || 0
  const rounded = Math.round(n * 100) / 100
  const hasPaise = Math.abs(rounded % 1) > 0.001
  return `₹${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

/** Quantities: 12, 12.5, 1,000 (no trailing zeros). */
export function formatQty(value: number): string {
  const n = Number(value) || 0
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

export interface SalesData {
  count: number
  total: number
  paid: number
}

export function composeSales(label: string, data: SalesData): AssistantCard {
  if (data.count === 0) {
    return {
      headline: formatRs(0),
      lines: [`${label} abhi tak koi bill nahi bana.`],
      note: NOTE,
    }
  }
  const lines = [
    `${label} ${data.count} bill bane, kul ${formatRs(data.total)} ki sales hui.`,
    `Usme se ${formatRs(data.paid)} payment aa chuka hai.`,
  ]
  const due = data.total - data.paid
  if (due > 0.5) lines.push(`${formatRs(due)} abhi baki hai.`)
  return { headline: formatRs(data.total), lines, note: NOTE }
}

export interface TopItem {
  name: string
  qty: number
  total: number
}

export function composeTopItems(label: string, items: TopItem[]): AssistantCard {
  if (items.length === 0) {
    return {
      headline: 'Koi item nahi bika',
      lines: [`${label} kisi item ki sale record nahi hai.`],
      note: NOTE,
    }
  }
  return {
    headline: items[0].name,
    lines: [
      `${label} sabse zyada bikne wale items:`,
      ...items.map(
        (it, i) => `${i + 1}. ${it.name}: ${formatQty(it.qty)} bika, ${formatRs(it.total)}`
      ),
    ],
    note: NOTE,
  }
}

export interface LowStockItem {
  name: string
  stock: number
  alert: number | null
}

export function composeLowStock(items: LowStockItem[]): AssistantCard {
  if (items.length === 0) {
    return {
      headline: 'Stock theek hai',
      lines: ['Abhi koi item low stock par nahi hai.'],
      note: NOTE,
    }
  }
  return {
    headline: `${items.length} item${items.length > 1 ? 's' : ''} low stock par`,
    lines: items.map((it) =>
      it.stock <= 0
        ? `${it.name}: stock khatam`
        : `${it.name}: sirf ${formatQty(it.stock)} bacha hai`
    ),
    note: NOTE,
  }
}

export interface Debtor {
  name: string
  amount: number
}

export function composeUdhaar(total: number, debtors: Debtor[]): AssistantCard {
  if (total <= 0) {
    return {
      headline: formatRs(0),
      lines: ['Kisi ka udhaar baki nahi hai. Sab clear hai.'],
      note: NOTE,
    }
  }
  return {
    headline: formatRs(total),
    lines: [
      `Kul ${formatRs(total)} udhaar baki hai.`,
      ...debtors.map((d) => `${d.name}: ${formatRs(d.amount)}`),
    ],
    note: NOTE,
  }
}

export function composeTopDebtors(total: number, debtors: Debtor[]): AssistantCard {
  if (total <= 0 || debtors.length === 0) {
    return {
      headline: 'Koi udhaar baki nahi',
      lines: ['Kisi customer ka udhaar baki nahi hai.'],
      note: NOTE,
    }
  }
  return {
    headline: formatRs(total),
    lines: [
      'In customers se udhaar lena hai:',
      ...debtors.map((d, i) => `${i + 1}. ${d.name}: ${formatRs(d.amount)}`),
    ],
    note: NOTE,
  }
}

export interface CustomerHistoryData {
  name: string
  billed: number
  paid: number
  due: number
  billCount: number
  lastBillDate: string | null
}

export function composeCustomerHistory(data: CustomerHistoryData): AssistantCard {
  const lines = [
    `Kul billing: ${formatRs(data.billed)} (${data.billCount} bill)`,
    `Payment aaya: ${formatRs(data.paid)}`,
    data.due > 0.5
      ? `Udhaar baki: ${formatRs(data.due)}`
      : 'Udhaar baki: kuch nahi, sab clear hai.',
  ]
  if (data.lastBillDate) lines.push(`Aakhri bill: ${data.lastBillDate}`)
  return { headline: data.name, lines, note: NOTE }
}

export function composeCustomerNotFound(query: string): AssistantCard {
  return {
    headline: 'Customer nahi mila',
    lines: [
      `"${query}" naam ka koi customer nahi mila. Naam dobara check karo, ya Customers page par dekho.`,
    ],
    note: NOTE,
  }
}

export interface PaymentsTodayData {
  total: number
  count: number
  byMode: Array<{ mode: string; amount: number }>
}

export function composePaymentsToday(data: PaymentsTodayData): AssistantCard {
  if (data.count === 0) {
    return {
      headline: formatRs(0),
      lines: ['Aaj abhi tak koi payment record nahi hua.'],
      note: NOTE,
    }
  }
  const modeLabel = (m: string) =>
    m === 'cash' ? 'Cash' : m === 'upi' ? 'UPI' : m === 'card' ? 'Card' : m
  return {
    headline: formatRs(data.total),
    lines: [
      `Aaj ${data.count} payment mein kul ${formatRs(data.total)} aaya.`,
      ...data.byMode.map((m) => `${modeLabel(m.mode)}: ${formatRs(m.amount)}`),
    ],
    note: NOTE,
  }
}

export interface GstData {
  total: number
  cgst: number
  sgst: number
  igst: number
  billCount: number
}

export function composeGst(data: GstData): AssistantCard {
  if (data.billCount === 0) {
    return {
      headline: formatRs(0),
      lines: ['Is mahine abhi tak koi bill nahi bana, isliye GST bhi nahi bana.'],
      note: NOTE,
    }
  }
  const lines = [`Is mahine ${data.billCount} bill par kul GST ${formatRs(data.total)} bana.`]
  if (data.cgst > 0 || data.sgst > 0) {
    lines.push(`CGST: ${formatRs(data.cgst)} · SGST: ${formatRs(data.sgst)}`)
  }
  if (data.igst > 0) lines.push(`IGST: ${formatRs(data.igst)}`)
  return { headline: formatRs(data.total), lines, note: NOTE }
}

export function composeInvoiceTrend(
  label: string,
  count: number,
  total: number
): AssistantCard {
  if (count === 0) {
    return {
      headline: '0 bill',
      lines: [`${label} ek bhi bill nahi bana.`],
      note: NOTE,
    }
  }
  return {
    headline: `${count} bill`,
    lines: [`${label} ${count} bill bane, kul ${formatRs(total)} ke.`],
    note: NOTE,
  }
}

export function composeNavigate(label: string): AssistantCard {
  return {
    headline: label,
    lines: [`Tumhe ${label} page par le ja raha hoon.`],
    note: NOTE,
  }
}

/** Plain-text rendering of a card, for the message text part. */
export function cardToText(card: AssistantCard): string {
  return [card.headline, ...card.lines].join('\n')
}
