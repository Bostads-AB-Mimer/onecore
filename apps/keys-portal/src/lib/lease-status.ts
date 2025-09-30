import type { Lease } from '@/services/types'

const toMs = (d?: string) => (d ? new Date(d).getTime() : undefined)

/** Prefer terminationDate; otherwise leaseEndDate */
export const pickEndDate = (lease: Lease) =>
  lease.terminationDate ?? lease.leaseEndDate

export function deriveDisplayStatus(
  lease: Lease
): 'active' | 'upcoming' | 'ended' {
  const now = Date.now()
  const start = toMs(lease.leaseStartDate)
  const end = toMs(pickEndDate(lease))
  if (end && end < now) return 'ended'
  if (start && start > now) return 'upcoming'
  return 'active'
}
