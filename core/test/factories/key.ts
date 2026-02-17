import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type Key = keys.Key

export const KeyFactory = Factory.define<Key>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  keyName: `Key ${sequence}`,
  keySequenceNumber: sequence,
  flexNumber: 1,
  rentalObjectCode: `123-456-789/${sequence}`,
  keyType: 'LGH',
  keySystemId: '00000000-0000-0000-0000-000000000001',
  disposed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}))
