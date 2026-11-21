import { describe, expect, it } from 'vitest'
import {
  computeAttention,
  type AttentionInput,
  type AttentionIssue,
  type AttentionRequest,
  type AttentionShop,
  type AttentionToken,
} from './attention'

const NOW = new Date('2026-11-22T12:00:00.000Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString()
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3600 * 1000).toISOString()

function input(partial: Partial<AttentionInput>): AttentionInput {
  return { now: NOW, requests: [], tokens: [], shops: [], issues: [], ...partial }
}

const shop = (partial: Partial<AttentionShop>): AttentionShop => ({
  id: 'shop-1',
  name: 'Ramdev Kirana',
  status: 'live',
  created_at: hoursAgo(24 * 30),
  plan_status: 'active',
  plan_next_due: null,
  last_invoice_at: hoursAgo(2),
  ...partial,
})

const request = (partial: Partial<AttentionRequest>): AttentionRequest => ({
  id: 'req-1',
  shop_name: 'New Store',
  status: 'new',
  created_at: hoursAgo(1),
  assignee_id: null,
  last_activity_at: null,
  ...partial,
})

describe('attention engine', () => {
  it('flags a shop awaiting founder approval, founders only, at the top', () => {
    const items = computeAttention(
      input({ shops: [shop({ status: 'awaiting_approval', created_at: hoursAgo(3) })] })
    )
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('shop_approval')
    expect(items[0].founderOnly).toBe(true)
    expect(items[0].score).toBeGreaterThanOrEqual(90)
  })

  it('flags unassigned new requests only after 2 hours', () => {
    expect(
      computeAttention(input({ requests: [request({ created_at: hoursAgo(1) })] }))
    ).toHaveLength(0)
    const items = computeAttention(
      input({ requests: [request({ created_at: hoursAgo(3) })] })
    )
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('new_request_unassigned')
    expect(items[0].requestId).toBe('req-1')
  })

  it('does not flag an assigned new request', () => {
    const items = computeAttention(
      input({ requests: [request({ created_at: hoursAgo(9), assignee_id: 'admin-1' })] })
    )
    expect(items).toHaveLength(0)
  })

  it('flags called requests with no follow-up in 24h, using the last activity', () => {
    const fresh = computeAttention(
      input({
        requests: [
          request({ status: 'called', created_at: hoursAgo(72), last_activity_at: hoursAgo(2) }),
        ],
      })
    )
    expect(fresh).toHaveLength(0)
    const stale = computeAttention(
      input({
        requests: [
          request({ status: 'called', created_at: hoursAgo(72), last_activity_at: hoursAgo(30) }),
        ],
      })
    )
    expect(stale).toHaveLength(1)
    expect(stale[0].kind).toBe('called_no_followup')
  })

  it('flags tokens expiring within 12 hours, not later, not already dead', () => {
    const token = (expires_at: string): AttentionToken => ({
      shop_id: 'shop-1',
      shop_name: 'Ramdev Kirana',
      expires_at,
    })
    expect(computeAttention(input({ tokens: [token(hoursFromNow(13))] }))).toHaveLength(0)
    expect(computeAttention(input({ tokens: [token(hoursAgo(1))] }))).toHaveLength(0)
    const items = computeAttention(input({ tokens: [token(hoursFromNow(4))] }))
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('token_expiring')
  })

  it('flags shops pending activation over 24h, and quiet live shops over 7 days', () => {
    const pending = computeAttention(
      input({ shops: [shop({ status: 'pending_activation', created_at: hoursAgo(30) })] })
    )
    expect(pending.map((i) => i.kind)).toEqual(['activation_waiting'])
    const quiet = computeAttention(
      input({ shops: [shop({ last_invoice_at: hoursAgo(24 * 9) })] })
    )
    expect(quiet.map((i) => i.kind)).toEqual(['shop_quiet'])
    const busy = computeAttention(
      input({ shops: [shop({ last_invoice_at: hoursAgo(24 * 3) })] })
    )
    expect(busy).toHaveLength(0)
  })

  it('flags overdue plans', () => {
    const items = computeAttention(
      input({ shops: [shop({ plan_status: 'overdue', plan_next_due: hoursAgo(48) })] })
    )
    expect(items.map((i) => i.kind)).toEqual(['plan_overdue'])
  })

  it('flags open issues unassigned or untouched for 48h, never closed ones', () => {
    const issue = (partial: Partial<AttentionIssue>): AttentionIssue => ({
      digest: 'd1',
      title: 'TypeError in billing',
      status: 'new',
      assignee_id: null,
      last_admin_action_at: null,
      ...partial,
    })
    expect(computeAttention(input({ issues: [issue({})] }))).toHaveLength(1)
    expect(
      computeAttention(
        input({
          issues: [issue({ assignee_id: 'a1', last_admin_action_at: hoursAgo(50) })],
        })
      )
    ).toHaveLength(1)
    expect(
      computeAttention(
        input({
          issues: [issue({ assignee_id: 'a1', last_admin_action_at: hoursAgo(2) })],
        })
      )
    ).toHaveLength(0)
    expect(
      computeAttention(input({ issues: [issue({ status: 'informed' })] }))
    ).toHaveLength(0)
  })

  it('sorts by urgency score, approval first', () => {
    const items = computeAttention(
      input({
        shops: [
          shop({ id: 's-quiet', name: 'Quiet Shop', last_invoice_at: hoursAgo(24 * 10) }),
          shop({ id: 's-appr', name: 'Waiting Shop', status: 'awaiting_approval' }),
        ],
        tokens: [{ shop_id: 's-tok', shop_name: 'Token Shop', expires_at: hoursFromNow(2) }],
      })
    )
    expect(items.map((i) => i.kind)).toEqual(['shop_approval', 'token_expiring', 'shop_quiet'])
    const scores = items.map((i) => i.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })
})
