import { Factory } from 'fishery'
import { keys } from '@onecore/types'

type KeyLoan = keys.v1.KeyLoan
type KeyLoanWithDetails = keys.v1.KeyLoanWithDetails

export const KeyLoanFactory = Factory.define<KeyLoan>(({ sequence }) => ({
  id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
  keys: JSON.stringify([
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
  ]),
  keyCards: JSON.stringify([]),
  loanType: 'TENANT',
  contact: 'P123456',
  contact2: undefined,
  contactPerson: undefined,
  description: undefined,
  returnedAt: null,
  availableToNextTenantFrom: null,
  pickedUpAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user@mimer.nu',
  updatedBy: null,
}))

export const KeyLoanWithDetailsFactory = Factory.define<KeyLoanWithDetails>(
  ({ sequence }) => ({
    id: `00000000-0000-0000-0000-${sequence.toString().padStart(12, '0')}`,
    keys: JSON.stringify([
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    ]),
    keyCards: JSON.stringify([]),
    loanType: 'TENANT',
    contact: 'P123456',
    contact2: undefined,
    contactPerson: undefined,
    description: undefined,
    returnedAt: null,
    availableToNextTenantFrom: null,
    pickedUpAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user@mimer.nu',
    updatedBy: null,
    keysArray: [],
    keyCardsArray: [],
    receipts: [],
  })
)
