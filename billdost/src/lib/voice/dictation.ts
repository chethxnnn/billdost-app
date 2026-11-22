/**
 * Voice dictation logic for the BillDost Assistant (fix round 2,
 * Stage 3). Pure functions only: the Chatbot component owns the
 * browser SpeechRecognition object and feeds it plain data, so the
 * transcript math and the error mapping are unit tested here.
 *
 * The old voice input replaced the whole composer text with each
 * partial result, used en-US, stopped after one phrase, and showed
 * raw browser errors ("Voice recognition failed (network error)...")
 * as red toasts. None of that survives here: dictation appends to
 * what the user already typed, interim words stream into the
 * composer live, and every error maps to a calm in-panel note or a
 * silent retry, never a raw string.
 */

export interface SpeechResultLike {
  isFinal: boolean
  transcript: string
}

/**
 * Split one recognition event's full result list into the session's
 * committed (final) text and the still-changing interim text. In
 * continuous mode the browser keeps every result of the session in
 * the list, so recomputing from the whole list on each event is
 * correct and idempotent.
 */
export function splitResults(results: SpeechResultLike[]): { finalText: string; interimText: string } {
  let finalText = ''
  let interimText = ''
  for (const r of results) {
    const text = (r.transcript || '').trim()
    if (!text) continue
    if (r.isFinal) {
      finalText = finalText ? `${finalText} ${text}` : text
    } else {
      interimText = interimText ? `${interimText} ${text}` : text
    }
  }
  return { finalText, interimText }
}

/**
 * What the composer shows while dictating: the text that was
 * already typed when the mic started, then the session's final
 * words, then the interim words still being recognised. Parts join
 * with single spaces; empty parts drop out.
 */
export function combineTranscript(base: string, finalText: string, interimText: string): string {
  return [base.trim(), finalText.trim(), interimText.trim()].filter(Boolean).join(' ')
}

export type VoiceErrorAction =
  | 'retry-once' // silent auto-retry (network blip), note only if it fails again
  | 'fallback-language' // restart once with the fallback language
  | 'note' // calm in-panel note, dictation stops
  | 'silent' // just stop, no note at all

export interface VoiceErrorPlan {
  action: VoiceErrorAction
  /** Hinglish note for the 'note' action (and for a failed retry). */
  message?: string
  /** Show a Retry button next to the note. */
  canRetry?: boolean
}

/**
 * Map a SpeechRecognition error code to what the UI should do.
 * Raw browser error strings are never shown to the user.
 */
export function mapVoiceError(error: string): VoiceErrorPlan {
  switch (error) {
    case 'network':
      return {
        action: 'retry-once',
        message: 'Mic ka network issue hai. Ek baar aur try karo, ya type karke poochh lo.',
        canRetry: true,
      }
    case 'language-not-supported':
      return { action: 'fallback-language' }
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        action: 'note',
        message: 'Mic ki permission nahi mili. Browser ke address bar ke paas mic allow karke phir try karo.',
        canRetry: true,
      }
    case 'audio-capture':
      return {
        action: 'note',
        message: 'Mic nahi mila. Mic ya headphone check karke phir try karo.',
        canRetry: true,
      }
    case 'no-speech':
    case 'aborted':
      return { action: 'silent' }
    default:
      return {
        action: 'note',
        message: 'Voice typing ruk gayi. Type karke poochh lo, ya mic phir dabao.',
        canRetry: true,
      }
  }
}

/** Calm note shown when the browser has no speech recognition. */
export const VOICE_UNSUPPORTED_MESSAGE =
  'Is browser mein voice typing nahi hai. Chrome ya Edge mein mic se bol kar likh sakte ho.'

/** Primary dictation language, then the fallback if it is rejected. */
export const VOICE_LANG_PRIMARY = 'hi-IN'
export const VOICE_LANG_FALLBACK = 'en-IN'

/* Minimal structural types for the browser SpeechRecognition
   surface, so callers never need `any` to drive it. */
export interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export interface SpeechRecognitionResultEventLike {
  results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>
}

export interface SpeechRecognitionErrorEventLike {
  error?: string
}

export type SpeechRecognitionCtorLike = new () => SpeechRecognitionLike

export interface SpeechRecognitionWindowLike {
  SpeechRecognition?: unknown
  webkitSpeechRecognition?: unknown
}

/** The browser's SpeechRecognition constructor, or null. */
export function getSpeechRecognitionCtor(
  win: SpeechRecognitionWindowLike
): SpeechRecognitionCtorLike | null {
  const ctor = win.SpeechRecognition || win.webkitSpeechRecognition
  return typeof ctor === 'function' ? (ctor as SpeechRecognitionCtorLike) : null
}

/** True when the browser exposes a SpeechRecognition constructor. */
export function isSpeechRecognitionSupported(win: SpeechRecognitionWindowLike): boolean {
  return getSpeechRecognitionCtor(win) !== null
}
