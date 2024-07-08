import { Factory } from 'fishery'
import { Listing, ListingStatus } from 'onecore-types'

export const ListingFactory = Factory.define<Listing>(({ sequence }) => ({
  id: sequence,
  rentalObjectCode: `R${sequence + 1000}`,
  address: 'Sample Address',
  monthlyRent: 1000,
  districtCaption: 'Malmaberg',
  districtCode: 'MAL',
  blockCaption: 'LINDAREN 2',
  blockCode: '1401',
  objectTypeCaption: 'Carport',
  objectTypeCode: 'CPORT',
  rentalObjectTypeCaption: 'Standard hyresobjektstyp',
  rentalObjectTypeCode: 'STD',
  publishedFrom: new Date(),
  publishedTo: new Date(),
  vacantFrom: new Date(),
  status: ListingStatus.Active,
  waitingListType: 'Bilplats (intern)',
  applicants: [],
}))
