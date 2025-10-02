// lease-status.ts
import type { Lease } from '@/services/types'

const toMs = (d?: string) => (d ? new Date(d).getTime() : undefined)

// ——— CHANGED: only use lastDebitDate ———
export const pickEndDate = (lease: Lease) => lease.lastDebitDate ?? undefined

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
  const end = toMs(pickEndDate(lease)) // ← lastDebitDate-only

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
