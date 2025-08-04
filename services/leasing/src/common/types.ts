import { Listing } from 'onecore-types'

export type ListingWithoutRentalObject = Omit<Listing, 'rentalObject'>
