import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyLoan = keys.v1.KeyLoan

export const KeyLoanFactory = Factory.define<KeyLoan>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  keys: JSON.stringify([
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
  ]),
  contact: 'P123456',
  contact2: undefined,
  returnedAt: null,
  availableToNextTenantFrom: null,
  pickedUpAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user@mimer.nu',
  updatedBy: null,
}))
