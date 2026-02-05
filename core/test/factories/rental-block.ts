import { Factory } from 'fishery'

type RentalBlock = {
  id: string
  blockReasonId: string
  blockReason: string
  fromDate: string
  toDate: string | null
  amount: number | null
}

export const RentalBlockFactory = Factory.define<RentalBlock>(
  ({ sequence }) => ({
    id: `block-${sequence}`,
    blockReasonId: `reason-${sequence}`,
    blockReason: 'Underhållsarbete',
    fromDate: '2024-01-01T00:00:00Z',
    toDate: '2024-12-31T23:59:59Z',
    amount: 1000,
  })
)
