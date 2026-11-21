/**
 * The attention engine: what needs a human today, computed from
 * real data, ranked by urgency. Pure functions over plain rows so
 * the rules are unit-tested without a database. The Today screen
 * feeds it Supabase rows; nothing here invents a number.
 *
 * Rules (founder-approved, Nov 22):
 *  - a shop setup waiting on the founder's approval (founders only)
 *  - an unassigned application in "new" for over 2 hours
 *  - an application in "called" with no follow-up activity in 24h
 *  - an unused activation token expiring within 12 hours
 *  - a shop pending activation for over 24 hours
 *  - an open issue unassigned, or untouched by an admin for 48h
 *  - a live shop with no invoice in 7 days
 *  - a shop whose plan status is overdue
 */

export interface AttentionRequest {
  id: string
  shop_name: string
  status: string
  created_at: string
  assignee_id: string | null
  /** Latest call log or audit touch for this request, if any. */
  last_activity_at: string | null
}

export interface AttentionToken {
  shop_id: string
  shop_name: string
  expires_at: string
}

export interface AttentionShop {
  id: string
  name: string
  status: string
  created_at: string
  plan_status: string
  plan_next_due: string | null
  /** Latest invoice time for the shop, if it has ever billed. */
  last_invoice_at: string | null
}

export interface AttentionIssue {
  digest: string
  title: string
  status: string
  assignee_id: string | null
  /** Latest admin audit action on this digest, if any. */
  last_admin_action_at: string | null
}

export type AttentionKind =
  | 'shop_approval'
  | 'new_request_unassigned'
  | 'called_no_followup'
  | 'token_expiring'
  | 'activation_waiting'
  | 'issue_open'
  | 'shop_quiet'
  | 'plan_overdue'

export interface AttentionItem {
  kind: AttentionKind
  score: number
  title: string
  meta: string
  href: string
  actionLabel: string
  /** Only founder-level roles may see or act on this item. */
  founderOnly: boolean
  /** For request items: enables the inline Assign to me action. */
  requestId?: string
}

export interface AttentionInput {
  now: Date
  requests: AttentionRequest[]
  tokens: AttentionToken[]
  shops: AttentionShop[]
  issues: AttentionIssue[]
}

const HOUR = 3600 * 1000
const DAY = 24 * HOUR

function ageText(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / 60000))}m`
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`
  return `${Math.floor(ms / DAY)}d`
}

function hoursUntilText(ms: number): string {
  if (ms <= 0) return 'any moment'
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / 60000))}m`
  return `${Math.floor(ms / HOUR)}h`
}

export function computeAttention(input: AttentionInput): AttentionItem[] {
  const now = input.now.getTime()
  const items: AttentionItem[] = []

  for (const shop of input.shops) {
    const created = new Date(shop.created_at).getTime()

    if (shop.status === 'awaiting_approval') {
      items.push({
        kind: 'shop_approval',
        score: 95,
        title: `${shop.name} is waiting for your approval`,
        meta: `Setup prepared ${ageText(now - created)} ago. No activation link exists yet.`,
        href: `/shops/${shop.id}`,
        actionLabel: 'Review',
        founderOnly: true,
      })
    }

    if (shop.status === 'pending_activation' && now - created > DAY) {
      items.push({
        kind: 'activation_waiting',
        score: 76,
        title: `${shop.name} has not activated yet`,
        meta: `Shop created ${ageText(now - created)} ago and still waiting for its first login.`,
        href: `/shops/${shop.id}`,
        actionLabel: 'Open shop',
        founderOnly: false,
      })
    }

    if (shop.status === 'live') {
      const lastBill = shop.last_invoice_at
        ? new Date(shop.last_invoice_at).getTime()
        : created
      if (now - lastBill > 7 * DAY) {
        items.push({
          kind: 'shop_quiet',
          score: 52,
          title: `${shop.name} has gone quiet`,
          meta: shop.last_invoice_at
            ? `No bill in ${ageText(now - lastBill)}.`
            : 'Live, but has never made a bill.',
          href: `/shops/${shop.id}`,
          actionLabel: 'Open shop',
          founderOnly: false,
        })
      }
    }

    if (shop.plan_status === 'overdue') {
      items.push({
        kind: 'plan_overdue',
        score: 68,
        title: `${shop.name} has an overdue plan`,
        meta: shop.plan_next_due
          ? `Payment was due ${new Date(shop.plan_next_due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. A call, not a lockout.`
          : 'Plan status is overdue. A call, not a lockout.',
        href: `/shops/${shop.id}`,
        actionLabel: 'Open shop',
        founderOnly: false,
      })
    }
  }

  for (const req of input.requests) {
    const created = new Date(req.created_at).getTime()

    if (req.status === 'new' && !req.assignee_id && now - created > 2 * HOUR) {
      const extra = Math.min(10, Math.floor((now - created) / HOUR) - 2)
      items.push({
        kind: 'new_request_unassigned',
        score: 80 + extra,
        title: `Call ${req.shop_name}`,
        meta: `Requested ${ageText(now - created)} ago and still unassigned.`,
        href: `/applications/${req.id}`,
        actionLabel: 'Open',
        founderOnly: false,
        requestId: req.id,
      })
    }

    if (req.status === 'called') {
      const lastTouch = req.last_activity_at
        ? new Date(req.last_activity_at).getTime()
        : created
      if (now - lastTouch > DAY) {
        items.push({
          kind: 'called_no_followup',
          score: 72,
          title: `Follow up with ${req.shop_name}`,
          meta: `Marked called ${ageText(now - lastTouch)} ago, with nothing logged since.`,
          href: `/applications/${req.id}`,
          actionLabel: 'Log call',
          founderOnly: false,
          requestId: req.id,
        })
      }
    }
  }

  for (const token of input.tokens) {
    const expires = new Date(token.expires_at).getTime()
    if (expires > now && expires - now <= 12 * HOUR) {
      items.push({
        kind: 'token_expiring',
        score: 88,
        title: `Activation link for ${token.shop_name} expires soon`,
        meta: `The link dies in ${hoursUntilText(expires - now)} and the shop is not live yet.`,
        href: `/shops/${token.shop_id}`,
        actionLabel: 'Open shop',
        founderOnly: false,
      })
    }
  }

  for (const issue of input.issues) {
    if (issue.status !== 'new' && issue.status !== 'investigating') continue
    const lastAction = issue.last_admin_action_at
      ? new Date(issue.last_admin_action_at).getTime()
      : 0
    const untouched = now - lastAction > 48 * HOUR
    if (!issue.assignee_id || untouched) {
      items.push({
        kind: 'issue_open',
        score: !issue.assignee_id && untouched ? 66 : 60,
        title: `Issue: ${issue.title}`,
        meta: !issue.assignee_id
          ? 'Open and unassigned.'
          : 'Open, with no admin action in 48 hours.',
        href: `/issues?digest=${encodeURIComponent(issue.digest)}`,
        actionLabel: 'View',
        founderOnly: false,
      })
    }
  }

  return items.sort((a, b) => b.score - a.score)
}
