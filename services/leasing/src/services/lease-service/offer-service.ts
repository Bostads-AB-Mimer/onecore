import { Knex } from 'knex'
import { ApplicantStatus, ListingStatus, OfferStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'

import * as listingAdapter from './adapters/listing-adapter'
import * as offerAdapter from './adapters/offer-adapter'
import { AdapterResult } from './adapters/types'

export const acceptOffer = async (
  db: Knex,
  params: {
    applicantId: number
    listingId: number
    offerId: number
  }
): Promise<
  AdapterResult<
    null,
    | 'update-listing'
    | 'update-applicant'
    | 'update-offer'
    | 'update-offer-applicant'
    | 'unknown'
  >
> => {
  try {
    await db.transaction(async (trx) => {
      await updateListing(params.listingId, trx)
      await updateApplicant(
        trx,
        params.applicantId,
        ApplicantStatus.OfferAccepted
      )
      await updateOfferAnsweredStatus(
        trx,
        params.offerId,
        OfferStatus.Accepted,
        new Date()
      )
      await updateOfferApplicant(
        trx,
        params.offerId,
        params.listingId,
        params.applicantId,
        ApplicantStatus.OfferAccepted
      )
    })

    return { ok: true, data: null }
  } catch (err) {
    if (err === 'update-listing') {
      return { ok: false, err }
    }

    if (err === 'update-applicant') {
      return { ok: false, err }
    }

    if (err === 'update-offer') {
      return { ok: false, err }
    }

    if (err === 'update-offer-applicant') {
      return { ok: false, err }
    }

    return { ok: false, err: 'unknown' }
  }
}

export const denyOffer = async (
  db: Knex,
  params: {
    applicantId: number
    offerId: number
    listingId: number
  }
): Promise<
  AdapterResult<
    null,
    'update-applicant' | 'update-offer' | 'update-offer-applicant' | 'unknown'
  >
> => {
  try {
    await db.transaction(async (trx) => {
      await updateApplicant(
        trx,
        params.applicantId,
        ApplicantStatus.OfferDeclined
      )

      await updateOfferAnsweredStatus(
        trx,
        params.offerId,
        OfferStatus.Declined,
        new Date()
      )

      await updateOfferApplicant(
        trx,
        params.offerId,
        params.listingId,
        params.applicantId,
        ApplicantStatus.OfferDeclined
      )
    })

    return { ok: true, data: null }
  } catch (err) {
    if (err === 'update-applicant') {
      return { ok: false, err }
    }

    if (err === 'update-offer') {
      return { ok: false, err }
    }

    if (err === 'update-offer-applicant') {
      return { ok: false, err }
    }

    return { ok: false, err: 'unknown' }
  }
}

export const handleExpiredOffers = async (
  db: Knex
): Promise<AdapterResult<number[], 'unknown'>> => {
  const expiredOffers =
    await offerAdapter.getActiveOffersPastResponseDeadline(db)

  if (!expiredOffers.ok) {
    return { ok: false, err: 'unknown' }
  }

  const affectedListingIds: number[] = []

  for (const offer of expiredOffers.data) {
    try {
      await db.transaction(async (trx) => {
        await updateApplicant(
          trx,
          offer.applicantId,
          ApplicantStatus.OfferExpired
        )
        await updateOfferAnsweredStatus(
          trx,
          offer.id,
          OfferStatus.Expired,
          new Date()
        )
        await updateOfferApplicant(
          trx,
          offer.id,
          offer.listingId,
          offer.applicantId,
          ApplicantStatus.OfferExpired
        )
      })
      affectedListingIds.push(offer.listingId)
    } catch (err) {
      logger.error(err, `Error handling expired offer ${offer.id}`)
    }
  }

  return { ok: true, data: affectedListingIds }
}

const updateListing = async (listingId: number, trx: Knex) => {
  const updateListing = await listingAdapter.updateListingStatuses(
    [listingId],
    ListingStatus.Assigned,
    trx
  )

  if (!updateListing.ok) {
    throw 'update-listing'
  }
}

const updateApplicant = async (
  trx: Knex,
  applicantId: number,
  applicantStatus: ApplicantStatus
) => {
  const updateApplicant = await listingAdapter.updateApplicantStatus(trx, {
    applicantId,
    status: applicantStatus,
  })

  if (!updateApplicant.ok) {
    throw 'update-applicant'
  }
}

const updateOfferAnsweredStatus = async (
  trx: Knex,
  offerId: number,
  offerStatus: OfferStatus,
  answeredAt: Date
) => {
  const updateOffer = await offerAdapter.updateOfferAnsweredStatus(
    {
      offerId,
      status: offerStatus,
      answeredAt: answeredAt,
    },
    trx
  )
  if (!updateOffer.ok) {
    throw 'update-offer'
  }
}

const updateOfferApplicant = async (
  trx: Knex,
  offerId: number,
  listingId: number,
  applicantId: number,
  applicantStatus: ApplicantStatus
) => {
  const updatedOfferApplicants = await offerAdapter.updateOfferApplicant(trx, {
    offerId,
    listingId,
    applicantId,
    applicantStatus,
  })
  if (!updatedOfferApplicants.ok) {
    throw 'update-offer-applicant'
  }
}
