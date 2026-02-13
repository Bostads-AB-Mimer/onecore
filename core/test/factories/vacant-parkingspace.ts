import { Factory } from 'fishery'
import { RentalObject } from '@onecore/types'
import { RentalObjectRentFactory } from './rental-object-rent'

export const VacantParkingSpaceFactory = Factory.define<RentalObject>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Karl IX:s V 18',
    rent: RentalObjectRentFactory.build({
      rentalObjectCode: `R${sequence + 1000}`,
    }),
    districtCaption: 'Norr',
    districtCode: '2',
    propertyCaption: 'LINDAREN 2',
    propertyCode: '1401',
    residentialAreaCaption: 'Centrum',
    residentialAreaCode: 'CEN',
    objectTypeCaption: 'Carport',
    objectTypeCode: 'CPORT',
    vacantFrom: new Date(),
  })
)
