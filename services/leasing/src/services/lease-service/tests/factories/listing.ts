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
    address: 'Flugsnappargatan',
    monthlyRent: 1000,
    residentialAreaCode: '61145',
    residentialAreaCaption: 'Råby',
    districtCaption: 'Distrikt Väst',
    districtCode: '4',
    objectTypeCaption: 'Parkeringsplats utan el',
    objectTypeCode: 'PPLUEL',
    vacantFrom: new Date(),
  },
}))
