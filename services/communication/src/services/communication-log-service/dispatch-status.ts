import { communication } from '@onecore/types'

const TERMINAL: communication.RecipientStatus[] = [
  'delivered',
  'failed',
  'bounced',
  'cancelled',
]

/**
 * Derive a dispatch's status from its recipients' statuses. Mirrors the
 * cancel/reschedule gates: 'scheduled' = any scheduled, 'cancelled' = all
 * cancelled. See MIM-1911.
 */
export function deriveDispatchStatus(
  statuses: communication.RecipientStatus[]
): communication.DispatchStatus {
  if (statuses.length === 0) return 'failed'
  if (statuses.some((s) => s === 'scheduled')) return 'scheduled'
  if (statuses.every((s) => s === 'cancelled')) return 'cancelled'
  if (!statuses.every((s) => TERMINAL.includes(s))) return 'sending'
  if (statuses.every((s) => s === 'delivered')) return 'delivered'
  if (statuses.some((s) => s === 'delivered')) return 'partially_delivered'
  return 'failed'
}
