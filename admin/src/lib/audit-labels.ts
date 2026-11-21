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
  profile_updated: 'updated their profile name',
  shop_approved: 'approved the shop setup for',
  shop_sent_back: 'sent the shop setup back for',
  shop_marked_ready: 'marked the shop ready for review:',
  request_assigned: 'assigned the request:',
  request_started: 'started work on the request:',
  shop_owner_assigned: 'assigned support ownership of',
  issue_assigned: 'assigned the issue',
  issue_started: 'started work on the issue',
  call_logged: 'logged a call for',
  setting_updated: 'changed a platform setting',
  finance_exported: 'exported the finance sheet',
  customer_data_unmasked: 'viewed unmasked customer numbers for',
}

export function describeAction(action: string): string {
  return LABELS[action] ?? action.replace(/_/g, ' ')
}
