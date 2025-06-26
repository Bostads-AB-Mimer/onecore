import { Factory } from 'fishery'
import { Listing, ListingStatus } from 'onecore-types'

export const ListingFactory = Factory.define<Listing>(({ sequence }) => ({
  id: sequence,
  rentalObjectCode: `R${sequence + 1000}`,
  publishedFrom: new Date(),
  publishedTo: new Date(),
  status: ListingStatus.Active,
  rentalRule: 'SCORED',
  listingCategory: 'PARKING_SPACE',
  applicants: [],
  rentalObject: {
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
  },
}))
