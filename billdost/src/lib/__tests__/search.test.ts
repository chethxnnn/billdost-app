import { describe, it, expect } from 'vitest'
import { escapeIlike, ilikePattern, orIlikePattern } from '../search'

describe('escapeIlike', () => {
  it('leaves plain text untouched', () => {
    expect(escapeIlike('raju')).toBe('raju')
  })

  it('escapes percent so it cannot widen the search', () => {
    expect(escapeIlike('100%')).toBe('100\\%')
    expect(ilikePattern('%')).toBe('%\\%%')
  })

  it('escapes underscore and backslash', () => {
    expect(escapeIlike('a_b')).toBe('a\\_b')
    expect(escapeIlike('a\\b')).toBe('a\\\\b')
  })

  it('trims and wraps in ilikePattern', () => {
    expect(ilikePattern('  atta  ')).toBe('%atta%')
  })

  it('orIlikePattern strips filter-grammar characters', () => {
    expect(orIlikePattern('a,b(c)')).toBe('%a b c %')
    expect(orIlikePattern('100%')).toBe('%100\\%%')
  })
})
