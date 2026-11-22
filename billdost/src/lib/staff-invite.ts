import { normalizePhone } from './phone'

/**
 * Staff activation link helpers (Stage 4). The raw token is minted
 * server-side in the staff router; only its SHA-256 hash ever reaches
 * the database (migration 0025), exactly like shop activation. These
 * helpers are the isomorphic half: link building, the WhatsApp share
 * text and the join page's state vocabulary, shared by the settings
 * page and the join page so the two never drift.
 */
export type StaffJoinState =
  | 'valid'
  | 'expired'
  | 'used'
  | 'replaced'
  | 'invalid'

const JOIN_STATES: readonly string[] = [
  'valid',
  'expired',
  'used',
  'replaced',
  'invalid',
]

/** Unknown or tampered states collapse to invalid, never to valid. */
export function staffJoinState(value: unknown): StaffJoinState {
  return typeof value === 'string' && JOIN_STATES.includes(value)
    ? (value as StaffJoinState)
    : 'invalid'
}

export function buildJoinLink(baseUrl: string, rawToken: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/join/${rawToken}`
}

export function staffInviteMessage(
  shopName: string,
  role: string,
  link: string
): string {
  return `Namaste, ${shopName} ne aapko BillDost par ${role} ke roop mein team mein bulaya hai. Apna password set karke join karo: ${link} (ye link 72 ghante valid hai)`
}

/**
 * wa.me deep link with the invite text prefilled, or null when the
 * staff row carries no reachable phone number (the owner then just
 * copies the link and sends it however he likes).
 */
export function buildStaffInviteWhatsAppUrl(
  phone: string | null | undefined,
  shopName: string,
  role: string,
  link: string
): string | null {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(
    staffInviteMessage(shopName, role, link)
  )}`
}
