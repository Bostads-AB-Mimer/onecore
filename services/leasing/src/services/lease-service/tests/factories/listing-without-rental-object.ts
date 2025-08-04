import { Factory } from 'fishery'
import { Listing, ListingStatus } from 'onecore-types'
import { ListingWithoutRentalObject } from '../../../../common/types'

export const ListingWithoutRentalObjectFactory =
  Factory.define<ListingWithoutRentalObject>(({ sequence }) => ({
    id: sequence,
    rentalObjectCode: `R${sequence + 1000}`,
    publishedFrom: new Date(),
    publishedTo: new Date(),
    status: ListingStatus.Active,
    rentalRule: 'SCORED',
    listingCategory: 'PARKING_SPACE',
    applicants: [],
  }))
