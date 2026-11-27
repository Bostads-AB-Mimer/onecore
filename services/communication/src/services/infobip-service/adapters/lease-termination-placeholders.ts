import type { LeaseTerminationConfirmationEmail } from '@onecore/types'

import { dateFormatter } from './parking-space-formatting'

/** Placeholders for the lease_termination_confirmation system template. */
export const buildLeaseTerminationPlaceholders = (
  email: LeaseTerminationConfirmationEmail
): Record<string, string> => ({
  firstName: email.firstName,
  lastName: email.lastName,
  leaseId: email.leaseId,
  endDate: dateFormatter.format(new Date(email.endDate)),
  preferredMoveOutDate: email.preferredMoveOutDate
    ? dateFormatter.format(new Date(email.preferredMoveOutDate))
    : '',
  rentalObjectAddress: email.rentalObjectAddress ?? '',
  type: email.rentalType,
  // One or (rarely) two holders, comma-joined.
  tenantNames: email.tenants.map((tenant) => tenant.fullName).join(', '),
})
