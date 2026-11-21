import { describe, expect, it } from 'vitest'
import { computeTodayCounts, presenceOf } from './team-stats'

const NOW = new Date('2026-11-22T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60000).toISOString()

describe('presence', () => {
  it('is active now under five minutes', () => {
    expect(presenceOf(minutesAgo(0), NOW)).toEqual({ state: 'active', label: 'Active now' })
    expect(presenceOf(minutesAgo(4), NOW).state).toBe('active')
    expect(presenceOf(minutesAgo(5), NOW).state).toBe('away')
  })

  it('reads back in human units', () => {
    expect(presenceOf(minutesAgo(42), NOW).label).toBe('Active 42m ago')
    expect(presenceOf(minutesAgo(60 * 3), NOW).label).toBe('Active 3h ago')
    expect(presenceOf(minutesAgo(60 * 49), NOW).label).toBe('Active 2d ago')
  })

  it('handles a member who has never been seen', () => {
    expect(presenceOf(null, NOW)).toEqual({ state: 'never', label: 'Not seen yet' })
    expect(presenceOf(undefined, NOW).state).toBe('never')
  })
})

describe('today counts', () => {
  const audit = [
    { admin_user_id: 'a1', action: 'shop_created' },
    { admin_user_id: 'a1', action: 'shop_created' },
    { admin_user_id: 'a1', action: 'activation_issued' },
    { admin_user_id: 'a1', action: 'issue_fixed' },
    { admin_user_id: 'a1', action: 'issue_informed' },
    { admin_user_id: 'a1', action: 'issue_investigating' },
    { admin_user_id: 'a2', action: 'shop_created' },
    { admin_user_id: null, action: 'shop_activated' },
  ]
  const calls = [{ admin_id: 'a1' }, { admin_id: 'a1' }, { admin_id: 'a2' }]

  it('counts only the member, from audit and call logs', () => {
    const counts = computeTodayCounts(audit, calls, 'a1')
    expect(counts).toEqual({
      shopsSetup: 2,
      callsLogged: 2,
      issuesResolved: 2,
      linksSent: 1,
      totalActions: 6,
    })
  })

  it('gives zeroes, not errors, for a quiet member', () => {
    const counts = computeTodayCounts(audit, calls, 'a3')
    expect(counts.totalActions).toBe(0)
    expect(counts.callsLogged).toBe(0)
  })
})
