import { Factory } from 'fishery'
import { RentalObject } from '@onecore/types'
import { RentalObjectRentFactory } from './rental-object-rent'

export const RentalObjectFactory = Factory.define<RentalObject>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Sample Address',
    rent: RentalObjectRentFactory.build({
      rentalObjectCode: `R${sequence + 1000}`,
    }),
    districtCaption: 'Väst',
    districtCode: 'VAST',
    blockCaption: 'LINDAREN 2',
    blockCode: '1401',
    objectTypeCaption: 'Carport',
    objectTypeCode: 'CPORT',
    vacantFrom: new Date(),
    residentialAreaCaption: 'Malmaberg',
    residentialAreaCode: 'MAL',
  })
)
