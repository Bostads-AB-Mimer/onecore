import type { Lease } from '@/services/types'

const toMs = (d?: string) => (d ? new Date(d).getTime() : undefined)

/**
 * Effective end date for display/comparison:
 *   1) terminationDate (PNR payloads)
 *   2) lastDebitDate   (often present in property-id payloads)
 *   3) leaseEndDate    (legacy/fallback)
 */
export const pickEndDate = (lease: Lease) =>
  lease.terminationDate ?? lease.lastDebitDate ?? lease.leaseEndDate

function normalizeBackendStatus(
  s?: string
): 'active' | 'upcoming' | 'ended' | 'abouttoend' | null {
  const v = (s ?? '').trim().toLowerCase()
  if (!v) return null
  if (v === 'current' || v === 'active' || v === 'ongoing') return 'active'
  if (v === 'upcoming' || v === 'future' || v === 'planned') return 'upcoming'
  if (v === 'ended' || v === 'terminated' || v === 'ended/terminated')
    return 'ended'
  if (v === 'abouttoend' || v === 'about to end') return 'abouttoend'
  return null
}

export function deriveDisplayStatus(
  lease: Lease
): 'active' | 'upcoming' | 'ended' {
  const now = Date.now()
  const start = toMs(lease.leaseStartDate)
  const end = toMs(pickEndDate(lease))

  if (end && end < now) return 'ended'
  if (start && start > now) return 'upcoming'

  const mapped = normalizeBackendStatus(lease.status as any)
  if (mapped && mapped !== 'abouttoend') return mapped

  return 'active'
}

export function getDisplayEndDate(lease: Lease): string | undefined {
  const end = pickEndDate(lease)
  const endMs = toMs(end)
  if (end && endMs && endMs < Date.now()) return end
  return undefined
}
