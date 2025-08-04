import { Offer } from '../types'

//dependent services: onecore-leasing, onecore-core
interface OfferWithRentalObjectCode extends Offer {
  rentalObjectCode: string
}

export type { OfferWithRentalObjectCode }
