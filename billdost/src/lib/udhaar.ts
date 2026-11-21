/**
 * Udhaar (credit book) ageing helpers (blueprint D7).
 *
 * Pure functions only: the server returns each customer's outstanding
 * total and oldest unpaid bill date from the payments ledger; ageing
 * buckets are computed here so the udhaar page, and any future digest,
 * bucket identically. Buckets follow the blueprint: 0-7 days,
 * 8-30 days, 31-90 days, 90+ days.
 */

export type AgeingBucketKey = '0_7' | '8_30' | '31_90' | '90_plus'

export const AGEING_BUCKETS: Array<{ key: AgeingBucketKey; label: string }> = [
  { key: '0_7', label: '0-7 din' },
  { key: '8_30', label: '8-30 din' },
  { key: '31_90', label: '31-90 din' },
  { key: '90_plus', label: '90+ din' },
]

export function ageingBucketFor(daysOverdue: number): AgeingBucketKey {
  if (daysOverdue <= 7) return '0_7'
  if (daysOverdue <= 30) return '8_30'
  if (daysOverdue <= 90) return '31_90'
  return '90_plus'
}

/** Whole days between two dates (b minus a), never negative. */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.floor(ms / 86_400_000)
}

export interface UdhaarEntryLike {
  customer_id: string
  outstanding: number
  /** ISO date of the oldest unpaid bill, or null for opening-balance only. */
  oldest_unpaid_date: string | null
}

export interface AgeingSummary {
  total: number
  buckets: Record<AgeingBucketKey, { count: number; amount: number }>
}

/**
 * Summarise udhaar entries into the four ageing buckets. An entry
 * with no dated bill (opening balance only) counts as current (0-7).
 */
export function summariseAgeing<T extends UdhaarEntryLike>(
  entries: T[],
  now: Date = new Date()
): AgeingSummary {
  const buckets: AgeingSummary['buckets'] = {
    '0_7': { count: 0, amount: 0 },
    '8_30': { count: 0, amount: 0 },
    '31_90': { count: 0, amount: 0 },
    '90_plus': { count: 0, amount: 0 },
  }
  let total = 0
  for (const entry of entries) {
    const amount = Math.max(0, Number(entry.outstanding) || 0)
    if (amount <= 0) continue
    const days = entry.oldest_unpaid_date
      ? daysBetween(new Date(entry.oldest_unpaid_date), now)
      : 0
    const bucket = ageingBucketFor(days)
    buckets[bucket].count += 1
    buckets[bucket].amount += amount
    total += amount
  }
  return { total, buckets }
}
