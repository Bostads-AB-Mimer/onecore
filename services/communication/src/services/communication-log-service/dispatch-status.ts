import { communication } from '@onecore/types'

type RecipientStatus = communication.RecipientStatus
type DispatchStatus = communication.DispatchStatus
type StatusCounts = Partial<Record<RecipientStatus, number>>

/**
 * Derive a dispatch's status from a per-status recipient count map. This is the
 * single source of truth for dispatch-status classification; the SQL predicates
 * in the search adapter mirror it (kept in sync by dispatch-status.test.ts).
 * Mirrors the cancel/reschedule gates: 'scheduled' = any scheduled,
 * 'cancelled' = all cancelled. See MIM-1911.
 */
export function deriveDispatchStatusFromCounts(
  counts: StatusCounts,
  sendAtInFuture: boolean
): DispatchStatus {
  const has = (s: RecipientStatus) => (counts[s] ?? 0) > 0
  const total = Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0)

  // Empty is a defensive default only — real dispatches always have >=1
  // recipient. The SQL status predicates in db.ts match nothing for an empty
  // dispatch, so a zero-recipient row would badge 'failed' but not appear under
  // the failed filter (out of domain in practice).
  if (total === 0) return 'failed'
  // 'scheduled' only while the send time is still in the future; once it has
  // fired, leftover 'scheduled' recipients are stragglers awaiting delivery
  // reports and count as in-flight ('sending'), not scheduled.
  if (sendAtInFuture && has('scheduled')) return 'scheduled'
  if (total === (counts.cancelled ?? 0)) return 'cancelled'
  if (has('pending') || has('sent') || has('received') || has('scheduled'))
    return 'sending'
  if (total === (counts.delivered ?? 0)) return 'delivered'
  if (has('delivered')) return 'partially_delivered'
  return 'failed'
}

/**
 * Array convenience wrapper — folds statuses into counts and delegates.
 */
export function deriveDispatchStatus(
  statuses: RecipientStatus[],
  sendAtInFuture: boolean
): DispatchStatus {
  const counts: StatusCounts = {}
  for (const s of statuses) counts[s] = (counts[s] ?? 0) + 1
  return deriveDispatchStatusFromCounts(counts, sendAtInFuture)
}
