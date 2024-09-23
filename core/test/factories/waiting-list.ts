import { Factory } from 'fishery'
import { WaitingList } from 'onecore-types'

export const WaitingListFactory = Factory.define<WaitingList>(() => {
  return {
    applicantCaption: 'Foo Bar',
    contactCode: 'P12345',
    contractFromApartment: new Date('2024-02-29T23:00:00.000Z'),
    queuePoints: 45,
    queuePointsSocialConnection: 0,
    waitingListFrom: new Date('2024-01-31T23:00:00.000Z'),
    waitingListTypeCaption: 'Bostad',
  }
})
