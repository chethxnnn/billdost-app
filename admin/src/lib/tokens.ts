import { createHash, randomBytes } from 'node:crypto'

/**
 * Activation tokens (Admin Portal plan, Section 4). The raw token is
 * 32 random bytes, base64url-encoded, generated here on the server.
 * Only the SHA-256 hex digest is stored, in activation_tokens
 * .token_hash. The shop app computes the identical digest when the
 * owner presents the link; the two implementations must never drift.
 * The raw token exists after generation in exactly one place: the
 * message or clipboard of the person sending it.
 */
export function generateActivationToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashActivationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

export const ACTIVATION_TTL_HOURS = 72

export function activationExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000)
}

export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime()
}
