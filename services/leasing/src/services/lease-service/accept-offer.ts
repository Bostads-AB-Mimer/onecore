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
    'update-listing' | 'update-applicant' | 'update-offer' | 'unknown'
  >
> => {
  try {
    await db.transaction(async (trx) => {
      await updateListing(params.listingId, trx)
      await updateApplicant(params.applicantId, trx)
      await updateOffer(params.offerId, trx)
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

    return { ok: false, err: 'unknown' }
  }
}

const updateListing = async (listingId: number, trx: Knex) => {
  try {
    const updateListing = await listingAdapter.updateListingStatuses(
      [listingId],
      ListingStatus.Assigned,
      trx
    )

    if (updateListing === 0) {
      throw 'update-listing'
    }
  } catch (err) {
    throw 'update-listing'
  }
}

const updateApplicant = async (applicantId: number, trx: Knex) => {
  try {
    const updateApplicant = await listingAdapter.updateApplicantStatus(
      applicantId,
      ApplicantStatus.OfferAccepted,
      trx
    )

    if (!updateApplicant) {
      throw 'update-applicant'
    }
  } catch (err) {
    throw 'update-applicant'
  }
}

const updateOffer = async (offerId: number, trx: Knex) => {
  const updateOffer = await offerAdapter.updateOfferStatus(
    {
      offerId,
      status: OfferStatus.Accepted,
    },
    trx
  )

  if (!updateOffer.ok) {
    throw 'update-offer'
  }
}
