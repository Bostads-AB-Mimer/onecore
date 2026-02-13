import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyLoan = keys.v1.KeyLoan

/**
 * Factory for generating MAINTENANCE type KeyLoan test data.
 *
 * Note: keys and keyCards are stored in junction tables (key_loan_keys, key_loan_cards)
 * and are not part of the KeyLoan response schema.
 */
export const KeyLoanMaintenanceKeyFactory = Factory.define<KeyLoan>(
  ({ sequence }) => {
    const now = new Date()

    return {
      id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
      loanType: 'MAINTENANCE',
      contact: `Company ${sequence}`, // company field is now contact
      contact2: undefined,
      contactPerson: `Contact Person ${sequence}`,
      notes: `Maintenance key loan ${sequence}`,
      returnedAt: undefined, // null = not returned yet (active loan)
      availableToNextTenantFrom: undefined,
      pickedUpAt: new Date(now.getTime() - 86400000), // Picked up 1 day ago
      createdAt: new Date(now.getTime() - 86400000), // Created 1 day ago
      updatedAt: new Date(now.getTime() - 86400000),
      createdBy: `user-${sequence}`,
      updatedBy: undefined,
    }
  }
)
