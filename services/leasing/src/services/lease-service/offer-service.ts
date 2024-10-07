import { Knex } from 'knex'
import { ApplicantStatus, ListingStatus, OfferStatus } from 'onecore-types'

import { db } from './adapters/db'
import * as listingAdapter from './adapters/listing-adapter'
import * as offerAdapter from './adapters/offer-adapter'
import { AdapterResult } from './adapters/types'

export const acceptOffer = async (params: {
  applicantId: number
  listingId: number
  offerId: number
}): Promise<
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
      await updateOffer(trx, params.offerId, OfferStatus.Accepted)
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

export const denyOffer = async (params: {
  applicantId: number
  offerId: number
  listingId: number
}): Promise<
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
      await updateOffer(trx, params.offerId, OfferStatus.Declined)
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
  const updateApplicant = await listingAdapter.updateApplicantStatus(
    applicantId,
    applicantStatus,
    trx
  )

  if (!updateApplicant.ok) {
    throw 'update-applicant'
  }
}

const updateOffer = async (
  trx: Knex,
  offerId: number,
  offerStatus: OfferStatus
) => {
  const updateOffer = await offerAdapter.updateOfferStatus(
    {
      offerId,
      status: offerStatus,
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
