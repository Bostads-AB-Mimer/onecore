import { Listing } from '@onecore/types'

// TODO(UTH-389): goes away once Listing is the stored row and the composed
// view is ListingWithObjectDetails.
export type ListingWithoutRentalObject = Omit<Listing, 'rentalObject'>
