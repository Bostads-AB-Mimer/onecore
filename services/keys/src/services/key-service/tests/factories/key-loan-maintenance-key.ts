import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyLoanMaintenanceKeys = keys.v1.KeyLoanMaintenanceKeys

/**
 * Factory for generating KeyLoanMaintenanceKeys test data.
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
export const KeyLoanMaintenanceKeyFactory =
  Factory.define<KeyLoanMaintenanceKeys>(({ sequence }) => {
    return {
      id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
      keys: JSON.stringify([`key-${sequence}`]), // JSON string array with single key by default
      createdAt: new Date(),
      company: `Company ${sequence}`,
      contactPerson: `Contact Person ${sequence}`,
      returnedAt: undefined, // null = not returned yet (active loan)
      pickedUpAt: undefined,
      description: `Maintenance key loan ${sequence}`,
    }
  })
