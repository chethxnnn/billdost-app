/**
 * Team presence and per-member day counts, as pure functions so the
 * rules are testable: presence is "active now" under 5 minutes, and
 * today's counts come only from the audit log and call logs, never
 * from anything a screen merely displayed.
 */

export interface Presence {
  state: 'active' | 'away' | 'never'
  label: string
}

export function presenceOf(
  lastActiveAt: string | null | undefined,
  now: Date = new Date()
): Presence {
  if (!lastActiveAt) return { state: 'never', label: 'Not seen yet' }
  const diff = now.getTime() - new Date(lastActiveAt).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 5) return { state: 'active', label: 'Active now' }
  if (minutes < 60) return { state: 'away', label: `Active ${minutes}m ago` }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { state: 'away', label: `Active ${hours}h ago` }
  const days = Math.floor(hours / 24)
  return { state: 'away', label: `Active ${days}d ago` }
}

export interface AuditEntryLike {
  admin_user_id: string | null
  action: string
}

export interface TodayCounts {
  shopsSetup: number
  callsLogged: number
  issuesResolved: number
  linksSent: number
  totalActions: number
}

/** One member's day, counted from the two logs that cannot lie. */
export function computeTodayCounts(
  auditEntries: AuditEntryLike[],
  callLogs: { admin_id: string }[],
  adminId: string
): TodayCounts {
  const mine = auditEntries.filter((e) => e.admin_user_id === adminId)
  return {
    shopsSetup: mine.filter((e) => e.action === 'shop_created').length,
    callsLogged: callLogs.filter((c) => c.admin_id === adminId).length,
    issuesResolved: mine.filter(
      (e) => e.action === 'issue_fixed' || e.action === 'issue_informed'
    ).length,
    linksSent: mine.filter((e) => e.action === 'activation_issued').length,
    totalActions: mine.length,
  }
}
