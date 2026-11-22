import { describe, it, expect } from 'vitest'
import {
  staffJoinState,
  buildJoinLink,
  staffInviteMessage,
  buildStaffInviteWhatsAppUrl,
} from '../staff-invite'
import { hashActivationToken } from '../token-hash'

describe('staffJoinState', () => {
  it('passes the known states through', () => {
    expect(staffJoinState('valid')).toBe('valid')
    expect(staffJoinState('expired')).toBe('expired')
    expect(staffJoinState('used')).toBe('used')
    expect(staffJoinState('replaced')).toBe('replaced')
    expect(staffJoinState('invalid')).toBe('invalid')
  })

  it('collapses anything unknown to invalid', () => {
    expect(staffJoinState('VALID')).toBe('invalid')
    expect(staffJoinState('ok')).toBe('invalid')
    expect(staffJoinState(undefined)).toBe('invalid')
    expect(staffJoinState(null)).toBe('invalid')
    expect(staffJoinState(42)).toBe('invalid')
  })
})

describe('buildJoinLink', () => {
  it('joins base and token with exactly one slash', () => {
    expect(buildJoinLink('https://app.billdost.in', 'tok123')).toBe(
      'https://app.billdost.in/join/tok123'
    )
    expect(buildJoinLink('https://app.billdost.in/', 'tok123')).toBe(
      'https://app.billdost.in/join/tok123'
    )
    expect(buildJoinLink('https://app.billdost.in///', 'tok123')).toBe(
      'https://app.billdost.in/join/tok123'
    )
  })
})

describe('staff invite token hashing', () => {
  it('hashes to a stable SHA-256 hex digest (the 0025 storage format)', () => {
    const raw = 'staff-token-fixture'
    const hash = hashActivationToken(raw)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashActivationToken(raw)).toBe(hash)
    expect(hashActivationToken('other-token')).not.toBe(hash)
  })
})

describe('buildStaffInviteWhatsAppUrl', () => {
  const link = 'https://app.billdost.in/join/abc'

  it('builds a wa.me URL with the 91 prefix and the invite text encoded', () => {
    const url = buildStaffInviteWhatsAppUrl('9876543210', 'Sharma Store', 'cashier', link)
    expect(url).not.toBeNull()
    expect(url!.startsWith('https://wa.me/919876543210?text=')).toBe(true)
    const text = decodeURIComponent(url!.split('?text=')[1])
    expect(text).toContain('Sharma Store')
    expect(text).toContain('cashier')
    expect(text).toContain(link)
  })

  it('returns null when there is no reachable phone', () => {
    expect(buildStaffInviteWhatsAppUrl(null, 'S', 'cashier', link)).toBeNull()
    expect(buildStaffInviteWhatsAppUrl('', 'S', 'cashier', link)).toBeNull()
    expect(buildStaffInviteWhatsAppUrl('123', 'S', 'cashier', link)).toBeNull()
  })
})

describe('staffInviteMessage', () => {
  it('names the shop, the role and the link', () => {
    const msg = staffInviteMessage('Sharma Store', 'manager', 'LINK')
    expect(msg).toContain('Sharma Store')
    expect(msg).toContain('manager')
    expect(msg).toContain('LINK')
    expect(msg).toContain('72 ghante')
  })
})
