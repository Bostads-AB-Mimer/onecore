import { Factory } from 'fishery'

export type LeaseChange = {
  leaseId: string
  contactCode: string
  rentalObjectId: string
  action: 'create' | 'terminate' | 'void'
  timestamp: Date
}

export const LeaseChangeFactory = Factory.define<LeaseChange>(
  ({ sequence }) => ({
    leaseId: `123-456-00-0001/${String(sequence).padStart(2, '0')}`,
    contactCode: `P${100000 + sequence}`,
    rentalObjectId: '123-456-00-0001',
    action: 'create',
    timestamp: new Date('2026-04-29T08:30:00.000Z'),
  })
)
