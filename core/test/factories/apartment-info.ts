import { Factory } from 'fishery'
import { ApartmentInfo } from 'onecore-types'

export const ApartmentInfoFactory = Factory.define<ApartmentInfo>(() => ({
  rentalTypeCode: 'R',
  rentalType: 'Rental',
  address: 'Testgatan 1',
  code: 'TST',
  roomTypeCode: '1RK',
  number: '1',
  type: 'Apartment',
  entrance: 'A',
  floor: '1',
  hasElevator: true,
  washSpace: 'In unit',
  area: 50,
  estateCode: 'TST',
  estate: 'Test Estate',
  buildingCode: 'TST',
  building: 'Test Building',
}))
