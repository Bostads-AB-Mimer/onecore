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
    districtCaption: 'Väst',
    districtCode: 'VAST',
    blockCaption: 'LINDAREN 2',
    blockCode: '1401',
    objectTypeCaption: 'Carport',
    objectTypeCode: 'CPORT',
    residentialAreaCaption: 'Malmaberg',
    residentialAreaCode: 'MAL',
  })
)
