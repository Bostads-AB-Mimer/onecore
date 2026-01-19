import type { Lease } from '@/services/types'
import { deriveDisplayStatus } from '@/lib/lease-status'

const toMs = (d?: string) => (d ? new Date(d).getTime() : 0)

/**
 * Determines which contract should be prioritized (e.g., for auto-opening).
 * Priority order:
 * 1. Active housing contract with most recent leaseStartDate
 * 2. Upcoming housing contract with most recent leaseStartDate
 * 3. Any active contract (latest by start date)
 * 4. Any upcoming contract (latest by start date)
 * 5. Any ended contract (latest by start date)
 *
 * @returns The leaseId of the prioritized contract, or null if no contracts exist
 */
export function getPriorityContractId(contracts: Lease[]): string | null {
  const activeContracts = contracts.filter(
    (c) => deriveDisplayStatus(c) === 'active'
  )
  const upcomingContracts = contracts.filter(
    (c) => deriveDisplayStatus(c) === 'upcoming'
  )
  const endedContracts = contracts.filter(
    (c) => deriveDisplayStatus(c) === 'ended'
  )

  // Priority 1: Active housing contract with most recent leaseStartDate
  const activeHousingContracts = activeContracts.filter(
    (c) => c.type === 'Bostadskontrakt'
  )
  if (activeHousingContracts.length > 0) {
    const sorted = [...activeHousingContracts].sort(
      (a, b) => toMs(b.leaseStartDate) - toMs(a.leaseStartDate)
    )
    return sorted[0].leaseId
  }

  // Priority 2: Upcoming housing contract with most recent leaseStartDate
  const upcomingHousingContracts = upcomingContracts.filter(
    (c) => c.type === 'Bostadskontrakt'
  )
  if (upcomingHousingContracts.length > 0) {
    const sorted = [...upcomingHousingContracts].sort(
      (a, b) => toMs(b.leaseStartDate) - toMs(a.leaseStartDate)
    )
    return sorted[0].leaseId
  }

  // Priority 3: ANY active contract (latest by start date)
  if (activeContracts.length > 0) {
    const sorted = [...activeContracts].sort(
      (a, b) => toMs(b.leaseStartDate) - toMs(a.leaseStartDate)
    )
    return sorted[0].leaseId
  }

  // Priority 4: ANY upcoming contract (latest by start date)
  if (upcomingContracts.length > 0) {
    const sorted = [...upcomingContracts].sort(
      (a, b) => toMs(b.leaseStartDate) - toMs(a.leaseStartDate)
    )
    return sorted[0].leaseId
  }

  // Priority 5: ANY ended contract (latest by start date)
  if (endedContracts.length > 0) {
    const sorted = [...endedContracts].sort(
      (a, b) => toMs(b.leaseStartDate) - toMs(a.leaseStartDate)
    )
    return sorted[0].leaseId
  }

  // No priority contract if none exist
  return null
}
