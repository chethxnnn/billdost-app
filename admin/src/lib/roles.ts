/**
 * Admin roles and capabilities (Admin Portal plan, Section 12).
 * This matrix is the single source of truth: the UI hides what a role
 * cannot do, and every API route re-checks with can() before acting.
 * Hiding is courtesy; the check is the security.
 */
export type AdminRole =
  | 'founder'
  | 'co_founder'
  | 'support'
  | 'finance'
  | 'analyst'

export type Capability =
  | 'dashboard'
  | 'applications'
  | 'shop_setup'
  | 'activation_actions'
  | 'activation_approve'
  | 'assign'
  | 'call_log'
  | 'shops_view'
  | 'support_notes'
  | 'issues'
  | 'issues_status'
  | 'broadcasts'
  | 'finance_view'
  | 'finance_export'
  | 'plan_edit'
  | 'unmask'
  | 'team_view'
  | 'team_manage'
  | 'suspend_shop'
  | 'settings'
  | 'audit_view'

const ALL: AdminRole[] = ['founder', 'co_founder', 'support', 'finance', 'analyst']

const MATRIX: Record<Capability, AdminRole[]> = {
  dashboard: ['founder', 'co_founder', 'support', 'analyst'],
  applications: ['founder', 'co_founder', 'support'],
  shop_setup: ['founder', 'co_founder', 'support'],
  // The founder approval gate (Nov 22): teammates prepare setups,
  // but releasing an activation link, and approving a prepared shop,
  // are founder-level decisions. Support lost activation_actions;
  // loosening this is a one-line change, only on the founder's word.
  activation_actions: ['founder', 'co_founder'],
  activation_approve: ['founder', 'co_founder'],
  assign: ['founder', 'co_founder', 'support'],
  call_log: ['founder', 'co_founder', 'support'],
  shops_view: ['founder', 'co_founder', 'support', 'finance'],
  support_notes: ['founder', 'co_founder', 'support'],
  issues: ['founder', 'co_founder', 'support'],
  issues_status: ['founder', 'co_founder', 'support', 'finance'],
  broadcasts: ['founder', 'co_founder'],
  finance_view: ['founder', 'co_founder', 'finance'],
  finance_export: ['founder', 'co_founder', 'finance'],
  plan_edit: ['founder', 'co_founder', 'finance'],
  unmask: ['founder'],
  // Everyone on the team can see the directory, assignments and
  // their own stats; managing people stays founder-level.
  team_view: ALL,
  team_manage: ['founder', 'co_founder'],
  suspend_shop: ['founder', 'co_founder'],
  settings: ['founder', 'co_founder'],
  audit_view: ['founder', 'co_founder'],
}

export function can(role: AdminRole, capability: Capability): boolean {
  return MATRIX[capability].includes(role)
}

export function capabilitiesFor(role: AdminRole): Capability[] {
  return (Object.keys(MATRIX) as Capability[]).filter((c) => can(role, c))
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  founder: 'Founder',
  co_founder: 'Co-founder',
  support: 'Support',
  finance: 'Finance',
  analyst: 'Analyst',
}

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  founder: 'Everything, including team, unmasking and settings.',
  co_founder: 'Everything except managing the founder account.',
  support: 'Applications, calls, issues and shop support. Prepares shop setups; the founder approves them and releases activation links. No finance, no broadcasts.',
  finance: 'Finance views, plan edits and exports. No shop operations.',
  analyst: 'Read-only dashboard and reports.',
}

export function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === 'string' &&
    (ALL as string[]).includes(value)
  )
}
