import { Factory } from 'fishery'
import { RentalObject } from '@onecore/types'
import { RentalObjectRentFactory } from './rental-object-rent'
import { RentalObjectAvailabilityInfoFactory } from './rental-object-availability-info'

export const RentalObjectFactory = Factory.define<RentalObject>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Sample Address',
    availabilityInfo: RentalObjectAvailabilityInfoFactory.build({
      rentalObjectCode: `R${sequence + 1000}`,
      rent: RentalObjectRentFactory.build(),
      vacantFrom: new Date(),
    }),
    districtCaption: 'Malmaberg',
    districtCode: 'MAL',
    propertyCaption: 'LINDAREN 2',
    propertyCode: '1401',
    residentialAreaCaption: 'res_area',
    residentialAreaCode: 'RES_AREA',
    objectTypeCaption: 'Carport',
    objectTypeCode: 'CPORT',
  })
)
