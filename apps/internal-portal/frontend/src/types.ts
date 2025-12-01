import { RentalObject } from '@onecore/types'

export type RequestError<ErrorCode> = {
  status: number
  errorCode: ErrorCode
  errorHeading: string
  errorMessage: string
}

// Local extension of RentalObject for internal portal features
export interface RentalObjectWithListingHistory extends RentalObject {
  previousListingsCount?: number
}
