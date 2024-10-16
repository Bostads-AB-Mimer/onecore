import { logger } from 'onecore-utilities'
import { handleExpiredOffers } from '../adapters/leasing-adapter'
import * as internalParkingSpaceProcesses from '../processes/parkingspaces/internal'

const handleExpiredOffersScript = async () => {
  const handleExpiredOffersResult = await handleExpiredOffers()

  if (handleExpiredOffersResult.ok) {
    const affectedListingIds = handleExpiredOffersResult.data

    if (affectedListingIds) {
      for (const listingId of affectedListingIds) {
        try {
          await internalParkingSpaceProcesses.createOfferForInternalParkingSpace(
            listingId
          )

          logger.info(
            listingId,
            'Restarted offer batch for listing ' + listingId
          )
        } catch (err) {
          logger.error(
            err,
            'Could not restart offer batch for listing ' + listingId
          )
        }
      }
    }
  }
}

handleExpiredOffersScript()
