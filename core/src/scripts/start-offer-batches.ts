import { logger } from 'onecore-utilities'
import { getExpiredListingsWithNoOffers } from '../adapters/leasing-adapter'
import * as internalParkingSpaceProcesses from '../processes/parkingspaces/internal'

const startOfferBatches = async () => {
  const getExpiredListingsResult = await getExpiredListingsWithNoOffers()

  if (getExpiredListingsResult.ok) {
    const listingsReadyForOffers = getExpiredListingsResult.data

    if (listingsReadyForOffers) {
      for (const listing of listingsReadyForOffers) {
        try {
          await internalParkingSpaceProcesses.createOfferForInternalParkingSpace(
            listing.id
          )

          logger.info(
            listing.id,
            'Started offer batch for listing ' +
              listing.id +
              ' (rental object ' +
              listing.rentalObjectCode +
              ')'
          )
        } catch (err) {
          logger.error(
            err,
            'Could not restart offer batch for listing ' + listing.id
          )
        }
      }
    }
  }
}

startOfferBatches()
