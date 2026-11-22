/**
 * Assistant discoverability data (fix round 2, Stage 4).
 *
 * The deterministic engine can only answer questions it recognises,
 * so the panel has to teach the questions. Three surfaces share
 * this one catalogue:
 *  - QUICK_CHIPS: the persistent chip row above the composer.
 *  - COMMAND_GROUPS: the "Kya poochh sakte ho?" list in the panel.
 *  - followUpsFor: contextual chips after a deterministic answer.
 *
 * Every 'send' example here is asserted in unit tests to match a
 * real intent through matchIntent, so this catalogue can never
 * drift away from what the engine actually understands. Customer
 * examples are 'fill', not 'send': they land in the composer with
 * an example name (Ramesh) for the shopkeeper to replace with
 * their own customer's name, instead of firing a query for a
 * stranger.
 */

import type { IntentKind } from './intents'

/** Persistent chips above the composer (drawn from the intent list). */
export const QUICK_CHIPS: string[] = [
  'Aaj ki sales kitni hai?',
  'Is hafte ki sales kitni hai?',
  'Low stock kya hai?',
  'Udhaar kitna baki hai?',
  'Top items kaun se hain?',
  'Aaj payment kitna aaya?',
  'Is mahine GST kitna bana?',
]

export interface CommandExample {
  text: string
  action: 'send' | 'fill'
}

export interface CommandGroup {
  title: string
  /** Optional hint under the group title (e.g. the Customers note). */
  hint?: string
  examples: CommandExample[]
}

const send = (text: string): CommandExample => ({ text, action: 'send' })
const fill = (text: string): CommandExample => ({ text, action: 'fill' })

export const COMMAND_GROUPS: CommandGroup[] = [
  {
    title: 'Sales',
    examples: [
      send('Aaj ki sales kitni hai?'),
      send('Kal ki sales kitni thi?'),
      send('Is hafte ki sales kitni hai?'),
      send('Is mahine ki sales kitni hai?'),
      send('Is mahine GST kitna bana?'),
    ],
  },
  {
    title: 'Stock',
    examples: [
      send('Low stock kya hai?'),
      send('Top items kaun se hain?'),
      send('Is hafte ke top items?'),
    ],
  },
  {
    title: 'Udhaar',
    examples: [
      send('Udhaar kitna baki hai?'),
      send('Kis kis se udhaar lena hai?'),
      send('Aaj payment kitna aaya?'),
    ],
  },
  {
    title: 'Customers',
    hint: 'Naam apne customer ka likho. Example mein Ramesh hai, tap karne par sawal likhne ki jagah aa jayega.',
    examples: [
      fill('Ramesh ka udhaar kitna hai?'),
      fill('Ramesh ka hisaab dikhao'),
      fill('Ramesh ka balance kitna hai?'),
      fill('Ramesh ne kitna liya hai?'),
    ],
  },
  {
    // No GST example here on purpose: the engine answers data
    // questions before navigation, so "GST page kholo" returns this
    // month's GST figure instead of opening the report. The tests
    // below keep every example honest about that.
    title: 'Navigation',
    examples: [
      send('Naya bill banao'),
      send('Customers page kholo'),
      send('Stock page kholo'),
      send('Udhaar page kholo'),
      send('Analytics page kholo'),
    ],
  },
]

const FOLLOW_UPS: Partial<Record<IntentKind, string[]>> = {
  sales_summary: ['Is hafte ki sales kitni hai?', 'Top items kaun se hain?', 'Aaj kitne bill bane?'],
  invoice_trend: ['Aaj ki sales kitni hai?', 'Is hafte ki sales kitni hai?'],
  top_items: ['Low stock kya hai?', 'Aaj ki sales kitni hai?'],
  low_stock: ['Top items kaun se hain?', 'Catalog page kholo'],
  udhaar_total: ['Kis kis se udhaar lena hai?', 'Aaj payment kitna aaya?'],
  top_debtors: ['Udhaar kitna baki hai?', 'Aaj payment kitna aaya?'],
  customer_history: ['Udhaar kitna baki hai?', 'Kis kis se udhaar lena hai?'],
  payments_today: ['Aaj ki sales kitni hai?', 'Udhaar kitna baki hai?'],
  gst_month: ['Is mahine ki sales kitni hai?', 'Aaj ki sales kitni hai?'],
}

/**
 * Contextual follow-up chips for a deterministic answer card.
 * Navigation answers and unknown intents get none (the caller then
 * falls back to QUICK_CHIPS).
 */
export function followUpsFor(intent: string | undefined | null): string[] {
  if (!intent) return []
  return FOLLOW_UPS[intent as IntentKind] ?? []
}
