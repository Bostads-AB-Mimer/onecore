import { logger } from '@onecore/utilities'
import { getExpiredListingsWithNoOffers } from '../adapters/leasing-adapter'
import * as internalParkingSpaceProcesses from '../processes/parkingspaces/internal'
import { ProcessStatus } from '../common/types'

const startOfferBatches = async () => {
  const getExpiredListingsResult = await getExpiredListingsWithNoOffers()

  if (getExpiredListingsResult.ok) {
    const listingsReadyForOffers = getExpiredListingsResult.data

    if (listingsReadyForOffers) {
      for (const listing of listingsReadyForOffers) {
        const result =
          await internalParkingSpaceProcesses.createOfferForInternalParkingSpace(
            listing.id
          )

        if (result.processStatus === ProcessStatus.successful) {
          logger.info(
            listing.id,
            'Started offer batch for listing ' +
              listing.id +
              ' (rental object ' +
              listing.rentalObjectCode +
              ')'
          )
        } else {
          logger.error(
            result,
            'Could not start offer batch for listing ' + listing.id
          )
        }
      }
    }
  }
}

startOfferBatches()
