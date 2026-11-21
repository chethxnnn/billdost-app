import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import {
  ACTIVATION_TTL_HOURS,
  activationExpiry,
  generateActivationToken,
  hashActivationToken,
  isExpired,
} from './tokens'

describe('activation tokens', () => {
  it('generates base64url tokens from 32 random bytes', () => {
    const token = generateActivationToken()
    // 32 bytes base64url-encoded is 43 characters, no padding.
    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generates a different token every time', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateActivationToken()))
    expect(seen.size).toBe(50)
  })

  it('hashes with SHA-256 hex, matching the shop app implementation', () => {
    const token = 'sample-token-value'
    const expected = createHash('sha256').update(token, 'utf8').digest('hex')
    expect(hashActivationToken(token)).toBe(expected)
    expect(hashActivationToken(token)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never stores anything reversible: the hash differs from the token', () => {
    const token = generateActivationToken()
    expect(hashActivationToken(token)).not.toContain(token)
  })

  it('expires exactly 72 hours after issue', () => {
    const from = new Date('2026-11-21T10:00:00.000Z')
    const expiry = activationExpiry(from)
    expect(ACTIVATION_TTL_HOURS).toBe(72)
    expect(expiry.getTime() - from.getTime()).toBe(72 * 3600 * 1000)
    expect(isExpired(expiry, new Date(expiry.getTime() - 1))).toBe(false)
    expect(isExpired(expiry, expiry)).toBe(true)
    expect(isExpired(expiry, new Date(expiry.getTime() + 1000))).toBe(true)
  })
})
