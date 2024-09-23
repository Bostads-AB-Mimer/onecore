import { ProcessResult, ProcessStatus } from '../../../common/types'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { makeProcessError } from '../utils'
import { logger } from 'onecore-utilities'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import { OfferStatus, OfferWithRentalObjectCode } from 'onecore-types'
import { AdapterResult } from '../../../adapters/types'

type ReplyToOfferError =
  | 'no-offer'
  | 'no-contact'
  | 'no-listing'
  | 'close-offer'
  | 'get-other-offers'
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

    const closeOffer = await leasingAdapter.closeOfferByAccept(offer.id)

    if (!closeOffer.ok) {
      return makeProcessError('close-offer', 500, {
        message: `Something went wrong when closing the offer.`,
      })
    }

    const contact = await leasingAdapter.getContact(
      offer.offeredApplicant.contactCode
    )

    if (!contact.ok) {
      return makeProcessError('no-contact', 404, {
        message: `Contact ${offer.offeredApplicant.contactCode} could not be retrieved.`,
      })
    }

    const otherOffers = await getContactOtherActiveOffers({
      contactCode: contact.data.contactCode,
      excludeOfferId: offer.id,
    })

    if (!otherOffers.ok) {
      return makeProcessError('get-other-offers', 500, {
        message: `Other offers for ${offer.offeredApplicant.contactCode} could not be retrieved.`,
      })
    }

    const denyOtherOffers = await Promise.all(
      otherOffers.data.map((o) => denyOffer(o.id))
    )

    const failedDenyOtherOffers = denyOtherOffers.filter(
      (o) => o.processStatus === ProcessStatus.failed
    )

    if (failedDenyOtherOffers.length > 0) {
      // TODO: Add failed deny other offers to log
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

const getContactOtherActiveOffers = async (params: {
  contactCode: string
  excludeOfferId: number
}): Promise<AdapterResult<Array<OfferWithRentalObjectCode>, 'unknown'>> => {
  const res = await leasingAdapter.getOffersForContact(params.contactCode)
  if (!res.ok) {
    if (res.err === 'not-found') {
      return { ok: true, data: [] }
    }
    return { ok: false, err: 'unknown' }
  }

  return {
    ok: true,
    data: res.data
      .filter((o) => o.status === OfferStatus.Active)
      .filter((o) => o.id !== params.excludeOfferId),
  }
}
