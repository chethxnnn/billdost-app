/**
 * Deterministic intent matcher for the BillDost Assistant (Stage 7).
 *
 * The KPMG AI Billing pattern: the questions a shopkeeper actually
 * asks every day are a small, known set. Those are matched here, in
 * English and Hinglish, to fixed intents backed by fixed queries, so
 * the answer is composed from real shop data with exact figures and
 * can never be invented. Anything that does not match with
 * confidence returns null and the caller falls through to the
 * general AI flow.
 *
 * Pure functions only: no I/O, fully unit tested.
 */

export type Period = 'today' | 'yesterday' | 'week' | 'month'

export type IntentKind =
  | 'sales_summary'
  | 'top_items'
  | 'low_stock'
  | 'udhaar_total'
  | 'top_debtors'
  | 'customer_history'
  | 'payments_today'
  | 'gst_month'
  | 'invoice_trend'
  | 'navigate'

export interface MatchedIntent {
  kind: IntentKind
  period: Period
  /** Set for customer_history: the name the shopkeeper asked about. */
  customerQuery?: string
  /** Set for navigate: the app route to open. */
  destination?: string
  /** Set for navigate: the human label of the destination page. */
  destinationLabel?: string
}

/** Suggestion chips shown in the assistant's greeting state. */
export const SUGGESTION_CHIPS: string[] = [
  'Aaj ki sales kitni hai?',
  'Low stock kya hai?',
  'Kis kis se udhaar lena hai?',
  'Is mahine ki sales kitni hai?',
  'Aaj payment kitna aaya?',
  'Is mahine GST kitna bana?',
]

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[?!.,;:"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Word-boundary phrase check: every entry must appear as whole
 * words in the (already normalized) text, so "kal" never fires
 * inside another word and "sales" never fires inside a name.
 */
function has(text: string, ...phrases: string[]): boolean {
  const padded = ` ${text} `
  return phrases.some((p) => padded.includes(` ${p} `))
}

function periodOf(text: string, fallback: Period): Period {
  if (has(text, 'yesterday', 'kal')) return 'yesterday'
  if (has(text, 'is hafte', 'iss hafte', 'this week', 'hafte', 'weekly', 'week')) return 'week'
  if (has(text, 'is mahine', 'iss mahine', 'this month', 'mahine', 'monthly', 'month', 'mahina')) return 'month'
  if (has(text, 'aaj', 'today')) return 'today'
  return fallback
}

const NAVIGATE_TARGETS: Array<{ keys: string[]; destination: string; label: string }> = [
  { keys: ['new bill', 'bill banao', 'bill banana', 'naya bill', 'create bill', 'create invoice'], destination: '/invoices/new', label: 'New Bill' },
  { keys: ['pos', 'counter bill'], destination: '/pos', label: 'POS' },
  { keys: ['dashboard', 'home'], destination: '/dashboard', label: 'Dashboard' },
  { keys: ['invoice', 'invoices', 'bill list', 'bills'], destination: '/invoices', label: 'Invoices' },
  { keys: ['quotation', 'quotations', 'estimate'], destination: '/quotations', label: 'Quotations' },
  { keys: ['customer', 'customers', 'grahak'], destination: '/customers', label: 'Customers' },
  { keys: ['udhaar page', 'udhaar book', 'khata'], destination: '/udhaar', label: 'Udhaar' },
  { keys: ['payment', 'payments'], destination: '/payments', label: 'Payments' },
  { keys: ['catalog', 'products page', 'product list'], destination: '/catalog', label: 'Catalog' },
  { keys: ['inventory', 'stock page', 'godown'], destination: '/inventory', label: 'Inventory' },
  { keys: ['expense', 'expenses', 'kharcha'], destination: '/expenses', label: 'Expenses' },
  { keys: ['analytics', 'report', 'reports'], destination: '/analytics', label: 'Analytics' },
  { keys: ['gst'], destination: '/reports/gst', label: 'GST Report' },
  { keys: ['setting', 'settings'], destination: '/settings', label: 'Settings' },
]

const FILLER_PREFIX = /^(mujhe|please|batao|bata|dikhao|dikha|zara|bhai|yaar|mujhko)\s+/

/**
 * Match a shopkeeper's question to a fixed intent, or return null
 * when nothing matches with confidence (the caller then falls back
 * to the general AI flow). Data intents are checked before
 * navigation so "low stock dikhao" answers with data, while "stock
 * page kholo" navigates.
 */
export function matchIntent(raw: string): MatchedIntent | null {
  const text = normalizeText(raw)
  if (!text) return null

  // Low stock: an anchor phrase, not just the word stock (which also
  // appears in navigation requests like "stock page kholo").
  if (
    has(text, 'low stock', 'stock kam', 'kam stock', 'khatam hone', 'khatm hone', 'reorder', 'stock khatam', 'kya kya kam hai', 'kaun sa stock')
  ) {
    return { kind: 'low_stock', period: 'today' }
  }

  // Top debtors before the udhaar total: "kis kis se lena hai" is a
  // list question, not a total question.
  if (
    has(text, 'kis kis', 'kiske kiske', 'kaun kaun', 'sabse zyada udhaar', 'top debtor', 'debtors', 'udhaar wale', 'lene hai list', 'list of udhaar') ||
    (has(text, 'udhaar') && has(text, 'list', 'kaun', 'kis'))
  ) {
    return { kind: 'top_debtors', period: 'today' }
  }

  // A named customer's udhaar ("Ramesh ka udhaar kitna hai") is a
  // customer question, not the shop total: it must win over the
  // udhaar_total check just below.
  const namedUdhaar = text.match(/^(.+?)\s+(?:ka|ki|ke)\s+udhaar\b/)
  if (namedUdhaar) {
    const name = namedUdhaar[1].replace(FILLER_PREFIX, '').trim()
    if (name.length >= 2 && !has(name, 'aaj', 'kal', 'is', 'iss', 'sab', 'total', 'shop', 'dukaan')) {
      return { kind: 'customer_history', period: 'today', customerQuery: name }
    }
  }

  if (
    has(text, 'udhaar') &&
    has(text, 'kitna', 'total', 'baki', 'hai', 'outstanding', 'dues', 'baaki')
  ) {
    return { kind: 'udhaar_total', period: 'today' }
  }

  if (has(text, 'gst', 'tax collected', 'tax kitna')) {
    return { kind: 'gst_month', period: 'month' }
  }

  if (
    (has(text, 'payment') || has(text, 'collection', 'vasooli')) &&
    has(text, 'aaj', 'today', 'aaya', 'aaye', 'mila', 'mile', 'received', 'hua', 'hue')
  ) {
    return { kind: 'payments_today', period: 'today' }
  }

  if (
    has(text, 'sabse zyada bika', 'sabse zyada bikne', 'top selling', 'best selling', 'bestseller', 'best seller', 'top items', 'top products', 'konsa item', 'kaun sa item', 'kaunsi cheez sabse')
  ) {
    const p = periodOf(text, 'week')
    return { kind: 'top_items', period: p === 'month' ? 'week' : p }
  }

  // Bill count: needs both a document word and a counting word, so
  // "aaj ki sales" never lands here.
  if (
    has(text, 'bill', 'bills', 'invoice', 'invoices') &&
    has(text, 'kitne', 'kitna', 'count', 'number', 'bane', 'hua', 'hue', 'huye')
  ) {
    return { kind: 'invoice_trend', period: periodOf(text, 'today') }
  }

  if (has(text, 'sales', 'sale', 'bikri', 'kamai', 'bika', 'biki', 'revenue', 'turnover')) {
    return { kind: 'sales_summary', period: periodOf(text, 'today') }
  }

  // A named customer: "<name> ka/ki hisaab|history|udhaar|khata".
  const customerMatch = text.match(/^(.+?)\s+(?:ka|ki|ke)\s+(hisaab|hisab|history|udhaar|khata|balance|baki|baaki|dues?)\b/)
  if (customerMatch) {
    const name = customerMatch[1].replace(FILLER_PREFIX, '').trim()
    if (name.length >= 2 && !has(name, 'aaj', 'kal', 'is', 'iss', 'sab', 'total', 'shop', 'dukaan')) {
      return { kind: 'customer_history', period: 'today', customerQuery: name }
    }
  }
  const customerMatch2 = text.match(/^(.+?)\s+(?:ne kitna|ka kitna udhaar|par kitna)/)
  if (customerMatch2) {
    const name = customerMatch2[1].replace(FILLER_PREFIX, '').trim()
    if (name.length >= 2) {
      return { kind: 'customer_history', period: 'today', customerQuery: name }
    }
  }

  // Navigation: needs a clear "open / go" verb, or a bare page name.
  const wantsOpen =
    has(text, 'kholo', 'khol', 'open', 'go to', 'jao', 'dikhao page', 'page par', 'le chalo', 'navigate') ||
    text.split(' ').length <= 3
  if (wantsOpen) {
    for (const target of NAVIGATE_TARGETS) {
      if (target.keys.some((k) => text.includes(k))) {
        return {
          kind: 'navigate',
          period: 'today',
          destination: target.destination,
          destinationLabel: target.label,
        }
      }
    }
  }

  return null
}

/** Period label used in answer templates. */
export function periodLabel(period: Period): string {
  switch (period) {
    case 'today':
      return 'Aaj'
    case 'yesterday':
      return 'Kal'
    case 'week':
      return 'Is hafte'
    case 'month':
      return 'Is mahine'
  }
}

/**
 * Inclusive invoice_date range (YYYY-MM-DD strings) for a period,
 * given today's date in the shop's timezone. Week starts Monday.
 * Pure date math on the string, so it is testable without clocks.
 */
export function periodRange(
  period: Period,
  todayIst: string
): { from: string; to: string } {
  const [y, m, d] = todayIst.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
  switch (period) {
    case 'today':
      return { from: todayIst, to: todayIst }
    case 'yesterday': {
      const prev = new Date(base)
      prev.setUTCDate(prev.getUTCDate() - 1)
      return { from: fmt(prev), to: fmt(prev) }
    }
    case 'week': {
      const dow = base.getUTCDay() // 0 Sunday .. 6 Saturday
      const monday = new Date(base)
      monday.setUTCDate(monday.getUTCDate() - ((dow + 6) % 7))
      return { from: fmt(monday), to: todayIst }
    }
    case 'month': {
      const first = new Date(Date.UTC(y, m - 1, 1))
      return { from: fmt(first), to: todayIst }
    }
  }
}

/** Today's date (YYYY-MM-DD) in Asia/Kolkata for a given instant. */
export function istDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * UTC ISO bounds covering one IST calendar day: payments are stored
 * as timestamptz, invoices by their date column, so the payments
 * query needs real instants (IST midnight is 18:30 UTC the day
 * before).
 */
export function istDayBoundsUtc(todayIst: string): { fromIso: string; toIso: string } {
  const from = new Date(`${todayIst}T00:00:00+05:30`)
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}
