import type { RentalPropertyInfo } from '@onecore/types'

import { Lease } from '@/services/api/core/leaseService'

import { LeaseStatus } from './status'

export const sortLeasesByStatus = (
  leases: Lease[],
  rentalProperties: Record<string, RentalPropertyInfo | null>
): Lease[] => {
  // Sort leases with three tiers:
  // 1. Active/upcoming leases (with property data)
  // 2. Ended leases (with property data)
  // 3. Leases with missing property data
  return [...leases].sort((a, b) => {
    const aHasProperty = !!rentalProperties[a.rentalPropertyId]
    const bHasProperty = !!rentalProperties[b.rentalPropertyId]
    // API returns numeric values despite TypeScript types
    const aIsEnded = Number(a.status) === LeaseStatus.Ended
    const bIsEnded = Number(b.status) === LeaseStatus.Ended

    // If both have property data or both don't, sort by ended status
    if (aHasProperty === bHasProperty) {
      if (aIsEnded && !bIsEnded) return 1 // a is ended, b is not -> a goes after b
      if (!aIsEnded && bIsEnded) return -1 // a is not ended, b is -> a goes before b
      // Secondary: leases without lastDebitDate on top
      const aHasEnd = a.lastDebitDate ? 1 : 0
      const bHasEnd = b.lastDebitDate ? 1 : 0
      if (aHasEnd !== bHasEnd) return aHasEnd - bHasEnd

      // Tertiary: newest start date first
      return (
        new Date(b.leaseStartDate).getTime() -
        new Date(a.leaseStartDate).getTime()
      )
    }

    // Otherwise, prioritize those with property data
    if (aHasProperty && !bHasProperty) return -1
    if (!aHasProperty && bHasProperty) return 1
    return 0
  })
}
