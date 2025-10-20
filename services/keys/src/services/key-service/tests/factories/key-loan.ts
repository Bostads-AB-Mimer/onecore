import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyLoan = keys.v1.KeyLoan

/**
 * Factory for generating KeyLoan test data.
 *
 * The `keys` field is a JSON string array of key IDs.
 * By default, it generates a single key ID, but you can override with multiple:
 *
 * @example
 * // Single key (default)
 * const loan = KeyLoanFactory.build()
 *
 * @example
 * // Multiple keys
 * const loan = KeyLoanFactory.build({
 *   keys: JSON.stringify(['key-id-1', 'key-id-2', 'key-id-3'])
 * })
 */
export const KeyLoanFactory = Factory.define<KeyLoan>(({ sequence }) => {
  const now = new Date()

  return {
    id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    keys: JSON.stringify([`key-${sequence}`]), // JSON string array with single key by default
    contact: `contact-${sequence}@example.com`,
    contact2: undefined,
    returnedAt: undefined, // null = not returned yet (active loan)
    availableToNextTenantFrom: undefined,
    pickedUpAt: new Date(now.getTime() - 86400000), // Picked up 1 day ago
    createdAt: new Date(now.getTime() - 86400000), // Created 1 day ago
    updatedAt: new Date(now.getTime() - 86400000),
    createdBy: `user-${sequence}`,
    updatedBy: undefined,
  }
})
