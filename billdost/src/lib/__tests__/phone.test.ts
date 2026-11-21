import { describe, expect, it } from 'vitest'
import { normalizePhone } from '../phone'

describe('normalizePhone', () => {
  it('prefixes 91 to a bare 10 digit mobile', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210')
  })

  it('keeps an already prefixed 91 number', () => {
    expect(normalizePhone('919876543210')).toBe('919876543210')
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210')
  })

  it('drops a trunk 0', () => {
    expect(normalizePhone('09876543210')).toBe('919876543210')
  })

  it('strips formatting characters', () => {
    expect(normalizePhone('(98765) 432-10')).toBe('919876543210')
  })

  it('handles the 00 international prefix', () => {
    expect(normalizePhone('00919876543210')).toBe('919876543210')
  })

  it('rejects garbage and short numbers', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('abcdefghij')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
})
