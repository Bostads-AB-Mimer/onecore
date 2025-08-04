import { Factory } from 'fishery'
import { RentalObject } from 'onecore-types'

export const RentalObjectFactory = Factory.define<RentalObject>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Sample Address',
    monthlyRent: 1000,
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
