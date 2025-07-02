import { Factory } from 'fishery'
import { RentalObject } from 'onecore-types'

export const ParkingSpaceFactory = Factory.define<RentalObject>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Karl IX:s V 18',
    monthlyRent: 1000,
    districtCaption: 'Distrikt Norr',
    districtCode: '2',
    propertyCaption: 'LINDAREN 2',
    propertyCode: '1401',
    objectTypeCaption: 'Motorcykelgarage',
    objectTypeCode: 'MCGAR',
    residentialAreaCaption: 'Centrum',
    residentialAreaCode: 'CTR',
    vacantFrom: new Date('2023-10-01'),
  })
)
