import { Factory } from 'fishery'
import { WaitingList, WaitingListType } from 'onecore-types'

export const WaitingListFactory = Factory.define<WaitingList>(() => {
  return {
    queuePoints: 45,
    queueTime: new Date('2024-01-31T23:00:00.000Z'),
    type: WaitingListType.ParkingSpace,
  }
})
