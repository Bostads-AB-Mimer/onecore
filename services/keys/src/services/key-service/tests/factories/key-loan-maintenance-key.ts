import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyLoan = keys.v1.KeyLoan

/**
 * Factory for generating MAINTENANCE type KeyLoan test data.
 * This is a convenience wrapper around KeyLoanFactory for creating maintenance loans.
 *
 * The `keys` field is a JSON string array of key IDs.
 * By default, it generates a single key ID, but you can override with multiple:
 *
 * @example
 * // Single key (default)
 * const loan = KeyLoanMaintenanceKeyFactory.build()
 *
 * @example
 * // Multiple keys
 * const loan = KeyLoanMaintenanceKeyFactory.build({
 *   keys: JSON.stringify(['key-id-1', 'key-id-2', 'key-id-3'])
 * })
 */
export const KeyLoanMaintenanceKeyFactory = Factory.define<KeyLoan>(
  ({ sequence }) => {
    const now = new Date()

    return {
      id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
      keys: JSON.stringify([`key-${sequence}`]), // JSON string array with single key by default
      keyCards: JSON.stringify([]), // JSON string array of card IDs
      loanType: 'MAINTENANCE',
      contact: `Company ${sequence}`, // company field is now contact
      contact2: undefined,
      contactPerson: `Contact Person ${sequence}`,
      description: `Maintenance key loan ${sequence}`,
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
