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
    districtCaption: 'Malmaberg',
    districtCode: 'MAL',
    propertyCaption: 'LINDAREN 2',
    propertyCode: '1401',
    residentialAreaCaption: 'res_area',
    residentialAreaCode: 'RES_AREA',
    objectTypeCaption: 'Carport',
    objectTypeCode: 'CPORT',
    vacantFrom: new Date(),
  })
)
