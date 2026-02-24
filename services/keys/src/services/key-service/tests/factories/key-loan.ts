import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyLoan = keys.KeyLoan

/**
 * Factory for generating KeyLoan test data.
 *
 * Note: keys and keyCards are stored in junction tables (key_loan_keys, key_loan_cards)
 * and are not part of the KeyLoan response schema. Pass them in CreateKeyLoanRequest
 * when creating loans.
 *
 * @example
 * // Create a loan with keys
 * const loan = await keyLoansAdapter.createKeyLoan({
 *   ...KeyLoanFactory.build(),
 *   keys: [key1.id, key2.id],
 * })
 */
export const KeyLoanFactory = Factory.define<KeyLoan>(({ sequence }) => {
  const now = new Date()

  return {
    id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    loanType: 'TENANT',
    contact: `contact-${sequence}@example.com`,
    contact2: undefined,
    contactPerson: undefined,
    notes: undefined,
    returnedAt: undefined, // null = not returned yet (active loan)
    availableToNextTenantFrom: undefined,
    pickedUpAt: new Date(now.getTime() - 86400000), // Picked up 1 day ago
    createdAt: new Date(now.getTime() - 86400000), // Created 1 day ago
    updatedAt: new Date(now.getTime() - 86400000),
    createdBy: `user-${sequence}`,
    updatedBy: undefined,
  }
})
