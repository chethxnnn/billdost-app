/**
 * Plain-sentence rendering for audit actions (plan Section 7, Audit
 * log screen): "You resent the activation link for Ramdev Kirana,
 * 21 Nov, 9:42 PM." The log reads like a diary, not a database.
 */
const LABELS: Record<string, string> = {
  shop_created: 'set up the shop',
  activation_issued: 'sent an activation link for',
  shop_activated: 'was activated:',
  password_reset_link_created: 'created a password reset link for',
  shop_suspended: 'suspended',
  shop_reactivated: 'reactivated',
  support_note_added: 'added a support note on',
  plan_updated: 'updated the plan of',
  request_called: 'marked the request as called:',
  request_approved: 'approved the request:',
  request_rejected: 'rejected the request:',
  issue_new: 'reopened the issue',
  issue_investigating: 'started investigating the issue',
  issue_fixed: 'marked the issue fixed',
  issue_informed: 'marked the issue informed',
  announcement_created: 'created an announcement',
  announcement_removed: 'removed an announcement',
  broadcast_sent: 'sent a WhatsApp broadcast',
  broadcast_not_connected: 'tried a WhatsApp broadcast (not connected)',
  team_member_added: 'added a team member',
  team_member_updated: 'updated a team member',
  setting_updated: 'changed a platform setting',
  finance_exported: 'exported the finance sheet',
  customer_data_unmasked: 'viewed unmasked customer numbers for',
}

export function describeAction(action: string): string {
  return LABELS[action] ?? action.replace(/_/g, ' ')
}
