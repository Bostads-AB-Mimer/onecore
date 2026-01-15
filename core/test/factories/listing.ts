import { Factory } from 'fishery'
import { Listing, ListingStatus } from '@onecore/types'
import { RentalObjectFactory } from './rental-object'

export const ListingFactory = Factory.define<Listing>(({ sequence }) => ({
  id: sequence,
  rentalObjectCode: `R${sequence + 1000}`,
  publishedFrom: new Date(),
  publishedTo: new Date(),
  status: ListingStatus.Active,
  rentalRule: 'SCORED',
  listingCategory: 'PARKING_SPACE',
  applicants: [],
  rentalObject: RentalObjectFactory.build(),
}))
