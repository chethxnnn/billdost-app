/**
 * Phone normalisation for WhatsApp and wa.me links (blueprint C1).
 * One helper for the whole app: the old code had two divergent
 * normalisers and a hardcoded 91 prefix that broke on numbers already
 * carrying a country code or a leading 0.
 *
 * Returns an international-format digit string (country code plus
 * national number, no plus sign), or null when the input cannot be a
 * reachable Indian mobile number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')

  if (digits.startsWith('00')) digits = digits.slice(2)
  // Trunk prefix: 098765 43210 style numbers.
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  // Bare 10 digit Indian mobile.
  if (digits.length === 10) return `91${digits}`
  // Already carries the India country code.
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return null
}
