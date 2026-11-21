/**
 * Public site links. BillDost is invite-only (Admin Portal plan,
 * Sections 1 and 8): there is no public signup. The landing site at
 * NEXT_PUBLIC_LANDING_URL carries the Request Access form, and every
 * "create account" surface in this app points there instead.
 */
export const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? 'https://billdost.in'
