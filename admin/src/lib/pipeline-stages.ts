/**
 * Pipeline placement for shops that were created directly in the
 * Setup Studio and therefore have no access_requests row. The board
 * is driven by requests, but a shop must never exist in the system
 * and be invisible on it: direct shops join the same stages, mapped
 * from their lifecycle status.
 */

export type PipelineStage =
  | 'requested'
  | 'called'
  | 'setup'
  | 'approval'
  | 'linksent'
  | 'live'

export interface DirectShopRow {
  id: string
  name: string
  category: string
  status: string
  created_at: string
  owner_name: string
  owner_phone: string
  state: string | null
  support_owner_id: string | null
}

/** Which board column a direct shop sits in, from its shop status. */
export function directStageOf(status: string): PipelineStage | null {
  switch (status) {
    case 'awaiting_approval':
      return 'approval'
    case 'setup_returned':
      return 'setup'
    case 'pending_activation':
      return 'linksent'
    case 'live':
    case 'suspended':
      return 'live'
    default:
      return null
  }
}

/**
 * Which request-status filter chip also shows this direct shop, so
 * the board filters stay meaningful for direct creations: All shows
 * everything; a chip shows the direct shops in the matching stage.
 */
export function directFilterKey(status: string): string | null {
  switch (status) {
    case 'awaiting_approval':
    case 'setup_returned':
      return 'setup_done'
    case 'pending_activation':
      return 'activation_sent'
    case 'live':
    case 'suspended':
      return 'live'
    default:
      return null
  }
}

/** The one status-driven action a direct shop card offers. */
export function directActionLabel(status: string): string {
  switch (status) {
    case 'awaiting_approval':
      return 'Review shop'
    case 'setup_returned':
      return 'Continue setup'
    case 'pending_activation':
      return 'Send activation'
    default:
      return 'Open shop'
  }
}
