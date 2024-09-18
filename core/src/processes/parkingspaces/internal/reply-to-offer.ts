import { ProcessResult, ProcessStatus } from '../../../common/types'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { makeProcessError } from '../utils'
import { logger } from 'onecore-utilities'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'

type ReplyToOfferError =
  | 'no-offer'
  | 'no-contact'
  | 'no-listing'
  | 'close-offer'
  | 'send-email'
  | 'unknown'

export const acceptOffer = async (
  offerId: number
): Promise<ProcessResult<null, ReplyToOfferError>> => {
  try {
    //Get offer
    const res = await leasingAdapter.getOfferByOfferId(offerId)
    if (!res.ok) {
      logger.error('Offer not found')
      return makeProcessError('no-offer', 404, {
        message: `The offer ${offerId} does not exist or could not be retrieved.`,
      })
    }
    const offer = res.data

    //Get listing
    const listing = await propertyManagementAdapter.getPublishedParkingSpace(
      offer.rentalObjectCode
    )
    if (!listing || !listing.districtCode) {
      return makeProcessError('no-listing', 404, {
        message: `The parking space ${offer.rentalObjectCode} does not exist or is no longer available.`,
      })
    }

    //Get contact - behövs contact senare i flödet?
    // const contact = await leasingAdapter.getContact(
    //   offer.offeredApplicant.nationalRegistrationNumber
    // )
    // if (!contact) {
    //   return makeProcessError('no-contact', 404, {
    //     message: `Applicant ${offer.offeredApplicant.contactCode} could not be retrieved.`,
    //   })
    // }

    const closeOffer = await leasingAdapter.closeOfferByAccept(offer.id)
    if (!closeOffer.ok) {
      return makeProcessError('close-offer', 500, {
        message: `Something went wrong when closing the offer.`,
      })
    }

    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 202,
      data: null,
    }
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
}

export const denyOffer = async (
  offerId: number
): Promise<ProcessResult<null, ReplyToOfferError>> => {
  try {
    //Get offer
    const res = await leasingAdapter.getOfferByOfferId(offerId)
    if (!res.ok) {
      logger.error('Offer not found')
      return makeProcessError('no-offer', 404, {
        message: `The offer ${offerId} does not exist or could not be retrieved.`,
      })
    }
    const offer = res.data

    //Get listing
    const listing = await propertyManagementAdapter.getPublishedParkingSpace(
      offer.rentalObjectCode
    )
    if (!listing || !listing.districtCode) {
      return makeProcessError('no-listing', 404, {
        message: `The parking space ${offer.rentalObjectCode} does not exist or is no longer available.`,
      })
    }

    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 202,
      data: null,
    }
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
}

export const expireOffer = async (
  offerId: number
): Promise<ProcessResult<null, ReplyToOfferError>> => {
  try {
    //Get offer
    const res = await leasingAdapter.getOfferByOfferId(offerId)
    if (!res.ok) {
      logger.error('Offer not found')
      return makeProcessError('no-offer', 404, {
        message: `The offer ${offerId} does not exist or could not be retrieved.`,
      })
    }
    const offer = res.data

    //Get listing
    const listing = await propertyManagementAdapter.getPublishedParkingSpace(
      offer.listingId.toString()
    )
    if (!listing || !listing.districtCode) {
      return makeProcessError('no-listing', 404, {
        message: `The parking space ${offer.rentalObjectCode} does not exist or is no longer available.`,
      })
    }

    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 200,
      data: null,
    }
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
}
