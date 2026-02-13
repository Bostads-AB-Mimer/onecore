import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Key = keys.v1.Key

/**
 * Factory for generating test Key entities.
 *
 * Usage:
 * - factory.key.build() - generates one key with defaults
 * - factory.key.build({ keyName: 'Custom' }) - override specific fields
 * - factory.key.buildList(5) - generates 5 keys
 */
export const KeyFactory = Factory.define<Key>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
  keyName: `Key ${sequence}`,
  keySequenceNumber: sequence,
  flexNumber: undefined,
  rentalObjectCode: `ROC${String(sequence).padStart(4, '0')}`,
  keyType: 'LGH', // Default to apartment key
  keySystemId: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
  disposed: false,
}))
