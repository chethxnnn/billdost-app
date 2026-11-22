import { describe, it, expect } from 'vitest'
import { isValidGstin, GSTIN_PATTERN } from '@/lib/indian-states'

describe('isValidGstin', () => {
  it('accepts the canonical example and real-shaped GSTINs', () => {
    expect(isValidGstin('29ABCDE1234F1Z5')).toBe(true)
    expect(isValidGstin('27AAAPL1234C1ZE')).toBe(true)
    expect(isValidGstin('06ZZZZZ9999Z9Z9')).toBe(true)
  })

  it('trims and uppercases before checking', () => {
    expect(isValidGstin(' 29abcde1234f1z5 ')).toBe(true)
  })

  it('rejects wrong lengths', () => {
    expect(isValidGstin('29ABCDE1234F1Z')).toBe(false)
    expect(isValidGstin('29ABCDE1234F1Z55')).toBe(false)
    expect(isValidGstin('')).toBe(false)
    expect(isValidGstin(null)).toBe(false)
    expect(isValidGstin(undefined)).toBe(false)
  })

  it('rejects a letter in the state code and digits in the PAN letters', () => {
    expect(isValidGstin('A9ABCDE1234F1Z5')).toBe(false)
    expect(isValidGstin('29ABC1E1234F1Z5')).toBe(false)
  })

  it('rejects a missing Z at position 14', () => {
    expect(isValidGstin('29ABCDE1234F1A5')).toBe(false)
  })

  it('the pattern is exactly 15 chars: 2 digits, 5 letters, 4 digits, letter, alphanumeric, Z, alphanumeric', () => {
    expect(GSTIN_PATTERN.test('29ABCDE1234F1Z5')).toBe(true)
    expect(GSTIN_PATTERN.test('29ABCDE12341ZZ5')).toBe(false)
  })
})
