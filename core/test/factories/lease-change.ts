import { Factory } from 'fishery'
import type { LeaseChange } from '@onecore/types'

export const LeaseChangeFactory = Factory.define<LeaseChange>(
  ({ sequence }) => ({
    leaseId: `123-456-00-0001/${String(sequence).padStart(2, '0')}`,
    contactCode: `P${100000 + sequence}`,
    rentalObjectId: '123-456-00-0001',
    action: 'create',
    timestamp: new Date('2026-04-29T08:30:00.000Z'),
  })
)
