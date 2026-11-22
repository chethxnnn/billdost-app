import { describe, expect, it } from 'vitest'
import {
  directActionLabel,
  directFilterKey,
  directStageOf,
} from './pipeline-stages'

describe('directStageOf', () => {
  it('maps every shop lifecycle status to a board column', () => {
    expect(directStageOf('awaiting_approval')).toBe('approval')
    expect(directStageOf('setup_returned')).toBe('setup')
    expect(directStageOf('pending_activation')).toBe('linksent')
    expect(directStageOf('live')).toBe('live')
    expect(directStageOf('suspended')).toBe('live')
  })

  it('returns null for unknown statuses so nothing renders in a wrong column', () => {
    expect(directStageOf('archived')).toBeNull()
    expect(directStageOf('')).toBeNull()
  })
})

describe('directFilterKey', () => {
  it('aligns direct shops with the request filter chips', () => {
    expect(directFilterKey('awaiting_approval')).toBe('setup_done')
    expect(directFilterKey('setup_returned')).toBe('setup_done')
    expect(directFilterKey('pending_activation')).toBe('activation_sent')
    expect(directFilterKey('live')).toBe('live')
    expect(directFilterKey('suspended')).toBe('live')
    expect(directFilterKey('archived')).toBeNull()
  })
})

describe('directActionLabel', () => {
  it('offers the status-driven primary action', () => {
    expect(directActionLabel('awaiting_approval')).toBe('Review shop')
    expect(directActionLabel('setup_returned')).toBe('Continue setup')
    expect(directActionLabel('pending_activation')).toBe('Send activation')
    expect(directActionLabel('live')).toBe('Open shop')
    expect(directActionLabel('suspended')).toBe('Open shop')
  })
})
