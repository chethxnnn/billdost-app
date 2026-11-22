import { describe, it, expect } from 'vitest'
import {
  splitResults,
  combineTranscript,
  mapVoiceError,
  isSpeechRecognitionSupported,
  VOICE_UNSUPPORTED_MESSAGE,
} from '@/lib/voice/dictation'

describe('splitResults', () => {
  it('separates final and interim results', () => {
    const out = splitResults([
      { isFinal: true, transcript: 'aaj ki' },
      { isFinal: true, transcript: 'sales' },
      { isFinal: false, transcript: 'kitni' },
    ])
    expect(out.finalText).toBe('aaj ki sales')
    expect(out.interimText).toBe('kitni')
  })

  it('is idempotent over the full session list (continuous mode)', () => {
    const results = [
      { isFinal: true, transcript: 'low stock' },
      { isFinal: false, transcript: 'kya hai' },
    ]
    expect(splitResults(results)).toEqual(splitResults(results))
  })

  it('skips empty transcripts', () => {
    const out = splitResults([
      { isFinal: true, transcript: '  ' },
      { isFinal: false, transcript: '' },
    ])
    expect(out).toEqual({ finalText: '', interimText: '' })
  })
})

describe('combineTranscript', () => {
  it('appends dictation after text typed before the mic started', () => {
    expect(combineTranscript('Ramesh ka', 'udhaar kitna', 'hai')).toBe('Ramesh ka udhaar kitna hai')
  })

  it('drops empty parts and never doubles spaces', () => {
    expect(combineTranscript('', 'aaj ki sales', '')).toBe('aaj ki sales')
    expect(combineTranscript('  ', '', '')).toBe('')
    expect(combineTranscript('hello', '', 'world')).toBe('hello world')
  })
})

describe('mapVoiceError', () => {
  it('network errors retry silently once, then a calm note with retry', () => {
    const plan = mapVoiceError('network')
    expect(plan.action).toBe('retry-once')
    expect(plan.canRetry).toBe(true)
    expect(plan.message).toBeTruthy()
    // Never the raw browser wording.
    expect(plan.message).not.toMatch(/network error|recognition failed/i)
  })

  it('permission errors explain how to allow the mic', () => {
    for (const code of ['not-allowed', 'service-not-allowed']) {
      const plan = mapVoiceError(code)
      expect(plan.action).toBe('note')
      expect(plan.message).toMatch(/permission/i)
    }
  })

  it('no-speech and aborted stop silently', () => {
    expect(mapVoiceError('no-speech').action).toBe('silent')
    expect(mapVoiceError('aborted').action).toBe('silent')
  })

  it('unsupported language falls back instead of showing a note', () => {
    expect(mapVoiceError('language-not-supported').action).toBe('fallback-language')
  })

  it('unknown errors get a calm generic note, never the raw code', () => {
    const plan = mapVoiceError('some-raw-browser-code')
    expect(plan.action).toBe('note')
    expect(plan.message).not.toContain('some-raw-browser-code')
  })
})

describe('isSpeechRecognitionSupported', () => {
  it('detects either constructor', () => {
    expect(isSpeechRecognitionSupported({ SpeechRecognition: class {} })).toBe(true)
    expect(isSpeechRecognitionSupported({ webkitSpeechRecognition: class {} })).toBe(true)
    expect(isSpeechRecognitionSupported({})).toBe(false)
  })

  it('the unsupported note is calm and names a working browser', () => {
    expect(VOICE_UNSUPPORTED_MESSAGE).toMatch(/Chrome/)
  })
})
