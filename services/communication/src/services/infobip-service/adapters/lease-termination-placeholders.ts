import type { LeaseTerminationConfirmationEmail } from '@onecore/types'

import { dateFormatter } from './parking-space-formatting'

// Parking leases normally have one holder, with the odd two-holder exception.
// The template has fixed tenant1*/tenant2* slots, so always emit at least two
// sets — an unused slot must merge as empty, not as a literal {{token}}.
const MIN_TENANT_SLOTS = 2

/**
 * Infobip placeholders for the lease termination confirmation template. Used
 * by both the send and the communication-log render so they cannot drift.
 */
export const buildLeaseTerminationPlaceholders = (
  email: LeaseTerminationConfirmationEmail
): Record<string, string> => {
  const placeholders: Record<string, string> = {
    firstName: email.firstName,
    lastName: email.lastName,
    leaseId: email.leaseId,
    endDate: dateFormatter.format(new Date(email.endDate)),
    preferredMoveOutDate: email.preferredMoveOutDate
      ? dateFormatter.format(new Date(email.preferredMoveOutDate))
      : '',
    rentalObjectAddress: email.rentalObjectAddress ?? '',
    type: email.rentalType,
  }

  const slots = Math.max(email.tenants.length, MIN_TENANT_SLOTS)
  for (let i = 0; i < slots; i++) {
    const tenant = email.tenants[i]
    const prefix = `tenant${i + 1}`
    placeholders[`${prefix}Name`] = tenant?.fullName ?? ''
    placeholders[`${prefix}BirthDate`] = tenant?.birthDate ?? ''
    placeholders[`${prefix}Address`] = tenant?.street ?? ''
    placeholders[`${prefix}PostalCode`] = tenant?.zipCode ?? ''
    placeholders[`${prefix}City`] = tenant?.city ?? ''
  }

  return placeholders
}
