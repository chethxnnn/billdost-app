import type { LanguageCode } from '../store/language'

/**
 * The shop record (shops.language) is the single source of truth for the
 * app language. Onboarding writes free-form values ('hinglish', 'en',
 * 'hi', 'kn'); this normalises anything stored there into the three
 * codes the dictionaries actually ship.
 */
export function normalizeShopLanguage(value: string | null | undefined): LanguageCode {
  switch ((value || '').trim().toLowerCase()) {
    case 'hi':
    case 'hindi':
    case 'hinglish':
      return 'hi'
    case 'kn':
    case 'kannada':
      return 'kn'
    case 'en':
    case 'english':
    default:
      return 'en'
  }
}

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
]
