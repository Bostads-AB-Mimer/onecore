import { Factory } from 'fishery'
import { RentalObject } from 'onecore-types'

export const RentalObjectFactory = Factory.define<RentalObject>(
  ({ sequence }) => ({
    rentalObjectCode: `R${sequence + 1000}`,
    address: 'Sample Address',
    monthlyRent: 1000,
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
