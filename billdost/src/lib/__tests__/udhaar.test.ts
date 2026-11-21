import { describe, expect, it } from 'vitest'
import {
  ageingBucketFor,
  daysBetween,
  summariseAgeing,
} from '../udhaar'

describe('ageingBucketFor', () => {
  it('buckets the blueprint boundaries exactly', () => {
    expect(ageingBucketFor(0)).toBe('0_7')
    expect(ageingBucketFor(7)).toBe('0_7')
    expect(ageingBucketFor(8)).toBe('8_30')
    expect(ageingBucketFor(30)).toBe('8_30')
    expect(ageingBucketFor(31)).toBe('31_90')
    expect(ageingBucketFor(90)).toBe('31_90')
    expect(ageingBucketFor(91)).toBe('90_plus')
    expect(ageingBucketFor(400)).toBe('90_plus')
  })
})

describe('daysBetween', () => {
  it('counts whole days and never goes negative', () => {
    expect(daysBetween(new Date('2026-11-01'), new Date('2026-11-08'))).toBe(7)
    expect(daysBetween(new Date('2026-11-08'), new Date('2026-11-01'))).toBe(0)
    expect(daysBetween(new Date('2026-11-01'), new Date('2026-11-01'))).toBe(0)
  })
})

describe('summariseAgeing', () => {
  const now = new Date('2026-11-21T12:00:00Z')

  it('sums totals and splits amounts into buckets', () => {
    const summary = summariseAgeing(
      [
        { customer_id: 'a', outstanding: 100, oldest_unpaid_date: '2026-11-20' },
        { customer_id: 'b', outstanding: 200, oldest_unpaid_date: '2026-11-01' },
        { customer_id: 'c', outstanding: 300, oldest_unpaid_date: '2026-08-01' },
        { customer_id: 'd', outstanding: 50, oldest_unpaid_date: null },
        { customer_id: 'e', outstanding: 400, oldest_unpaid_date: '2026-09-21' },
      ],
      now
    )
    expect(summary.total).toBe(1050)
    expect(summary.buckets['0_7']).toEqual({ count: 2, amount: 150 })
    expect(summary.buckets['8_30']).toEqual({ count: 1, amount: 200 })
    expect(summary.buckets['31_90']).toEqual({ count: 1, amount: 400 })
    expect(summary.buckets['90_plus']).toEqual({ count: 1, amount: 300 })
  })

  it('ignores zero and negative outstanding entries', () => {
    const summary = summariseAgeing(
      [
        { customer_id: 'a', outstanding: 0, oldest_unpaid_date: '2026-01-01' },
        { customer_id: 'b', outstanding: -5, oldest_unpaid_date: '2026-01-01' },
      ],
      now
    )
    expect(summary.total).toBe(0)
  })
})
