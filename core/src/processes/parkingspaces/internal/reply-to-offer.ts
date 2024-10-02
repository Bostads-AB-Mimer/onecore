import { OfferStatus, OfferWithRentalObjectCode } from 'onecore-types'
import { logger } from 'onecore-utilities'

import { ProcessResult, ProcessStatus } from '../../../common/types'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import { makeProcessError } from '../utils'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import { AdapterResult } from '../../../adapters/types'

type ReplyToOfferError =
  | 'no-offer'
  | 'no-listing'
  | 'close-offer'
  | 'get-other-offers'
  | 'send-email'
  | 'create-lease-failed'
  | 'unknown'

export const acceptOffer = async (
  offerId: number
): Promise<ProcessResult<null, ReplyToOfferError>> => {
  const log: string[] = [
    `Tackat ja till erbjudande ${offerId}`,
    `Tidpunkt för ja tack: ${new Date()
      .toISOString()
      .substring(0, 16)
      .replace('T', ' ')}`,
  ]
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

    log.push(
      `Sökande ${offer.offeredApplicant.contactCode} har tackat ja till bilplats ${offer.rentalObjectCode}`
    )

    //Get listing
    const listing = await leasingAdapter.getListingByListingId(offer.listingId)

    if (!listing || !listing.districtCode) {
      return makeProcessError('no-listing', 404, {
        message: `The parking space ${offer.listingId.toString()} does not exist or is no longer available.`,
      })
    }

    //Create lease
    let lease: any
    try {
      lease = await leasingAdapter.createLease(
        listing.rentalObjectCode,
        offer.offeredApplicant.contactCode,
        listing.vacantFrom != undefined
          ? new Date(listing.vacantFrom).toISOString() // fix: vacantFrom is really a string...
          : new Date().toISOString(),
        '001'
      )

      log.push(`Kontrakt skapat: ${lease.LeaseId}`)
      log.push(
        'Kontrollera om moms ska läggas på kontraktet. Detta måste göras manuellt innan det skickas för påskrift.'
      )
    } catch (err) {
      logger.error(err, 'Create Lease failed')
      return makeProcessError('create-lease-failed', 500, {
        message: `Create Lease for ${offerId} failed.`,
      })
    }

    //Reset internal waiting list
    const internalWaitingListResult = await leasingAdapter.resetWaitingList(
      offer.offeredApplicant.nationalRegistrationNumber,
      offer.offeredApplicant.contactCode,
      'Bilplats (intern)'
    )
    if (!internalWaitingListResult.ok) {
      log.push(
        'Kunde inte återställa köpoäng för interna bilplatser: ' +
          internalWaitingListResult.err
      )
    }

    //Reset external waiting list
    const externalWaitingListResult = await leasingAdapter.resetWaitingList(
      offer.offeredApplicant.nationalRegistrationNumber,
      offer.offeredApplicant.contactCode,
      'Bilplats (extern)'
    )
    if (!externalWaitingListResult.ok) {
      log.push(
        'Kunde inte återställa köpoäng för externa bilplatser: ' +
          externalWaitingListResult.err
      )
    }

    //Deny other offers for this contact
    const otherOffers = await getContactOtherActiveOffers({
      contactCode: offer.offeredApplicant.contactCode,
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
      log.push(
        'Kunde inte neka följande andra erbjudanden för kunden: ' +
          failedDenyOtherOffers.join(', ')
      )
    }

    //Close offer
    const closeOffer = await leasingAdapter.closeOfferByAccept(offer.id)
    if (!closeOffer.ok) {
      return makeProcessError('close-offer', 500, {
        message: `Something went wrong when closing the offer.`,
      })
    }

    try {
      //send notification to the leasing team
      await communicationAdapter.sendNotificationToRole(
        'leasing',
        'Bilplats tilldelad och kontrakt skapat för intern bilplats',
        log.join('\n')
      )
    } catch (error) {
      console.log('log', log)
      logger.error(error, 'Send Notification to leasing failed')
    }

    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 202,
      data: null,
    }
  } catch (err) {
    logger.error(err, 'Accept offer of parking space uncaught error')
    return makeProcessError('unknown', 500)
  }
}

export const denyOffer = async (
  offerId: number
): Promise<ProcessResult<{ listingId: number }, ReplyToOfferError>> => {
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
    const listing = await leasingAdapter.getListingByListingId(offer.listingId)
    if (!listing || !listing.districtCode) {
      return makeProcessError('no-listing', 404, {
        message: `The parking space ${offer.listingId.toString()} does not exist or is no longer available.`,
      })
    }

    const closeOffer = await leasingAdapter.closeOfferByDeny(offer.id)

    if (!closeOffer.ok) {
      return makeProcessError('close-offer', 500, {
        message: `Something went wrong when closing the offer.`,
      })
    }

    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 202,
      data: { listingId: listing.id },
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
    const listing = await leasingAdapter.getListingByListingId(offer.listingId)
    if (!listing || !listing.districtCode) {
      return makeProcessError('no-listing', 404, {
        message: `The parking space ${offer.listingId.toString()} does not exist or is no longer available.`,
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
