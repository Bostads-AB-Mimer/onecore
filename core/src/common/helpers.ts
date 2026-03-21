import { Listing } from '@onecore/types'
import * as utils from '../utils'

export const calculateVacantFrom = (listing: Listing): Date => {
  const todaysDate = utils.date.getUTCDateWithoutTime(new Date())
  const vacantDate = listing.rentalObject.availabilityInfo?.vacantFrom
    ? utils.date.getUTCDateWithoutTime(
        new Date(listing.rentalObject.availabilityInfo.vacantFrom)
      )
    : null
  const fromDate =
    vacantDate && vacantDate > todaysDate ? vacantDate : todaysDate

  return fromDate
}
