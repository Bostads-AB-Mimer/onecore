import { logger } from '@onecore/utilities'
import { handleExpiredOffers } from '../adapters/leasing-adapter'
import * as internalParkingSpaceProcesses from '../processes/parkingspaces/internal'
import { ProcessStatus } from '../common/types'

const handleExpiredOffersScript = async () => {
  const handleExpiredOffersResult = await handleExpiredOffers()

  if (handleExpiredOffersResult.ok) {
    const affectedListingIds = handleExpiredOffersResult.data

    if (affectedListingIds) {
      for (const listingId of affectedListingIds) {
        const result =
          await internalParkingSpaceProcesses.createOfferForInternalParkingSpace(
            listingId
          )

        if (result.processStatus === ProcessStatus.successful) {
          logger.info(
            listingId,
            'Restarted offer batch for listing ' + listingId
          )
        } else {
          logger.error(
            result,
            'Could not restart offer batch for listing ' + listingId
          )
        }
      }
    }
  } else {
    logger.error(
      handleExpiredOffersResult,
      'Could not fetch expired offers from leasing'
    )
  }
}

handleExpiredOffersScript()
