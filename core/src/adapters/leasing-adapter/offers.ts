import { AxiosError, HttpStatusCode } from 'axios'
import { logger, loggedAxios as axios } from 'onecore-utilities'
import {
  CreateOfferParams,
  DetailedOffer,
  GetActiveOfferByListingIdErrorCodes,
  Offer,
  OfferWithOfferApplicants,
  OfferWithRentalObjectCode,
} from 'onecore-types'

import { AdapterResult } from '../types'
import config from '../../common/config'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

const createOffer = async (
  params: CreateOfferParams
): Promise<AdapterResult<Omit<Offer, 'selectedApplicants'>, 'unknown'>> => {
  try {
    const response = await axios.post<{ content: Offer }>(
      `${tenantsLeasesServiceUrl}/offer`,
      params
    )

    return { ok: true, data: response.data.content }
  } catch (err) {
    logger.error(err, 'Error creating offer:')
    return { ok: false, err: 'unknown' }
  }
}

const getOfferByOfferId = async (
  offerId: number
): Promise<AdapterResult<DetailedOffer, 'not-found' | 'unknown'>> => {
  try {
    const res = await axios(`${tenantsLeasesServiceUrl}/offers/${offerId}`)

    if (res.status == HttpStatusCode.NotFound) {
      return { ok: false, err: 'not-found' }
    }
    return { ok: true, data: res.data.content }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getOfferByOfferId')
    return { ok: false, err: 'unknown' }
  }
}

const getOffersByListingId = async (
  listingId: number
): Promise<AdapterResult<Array<OfferWithOfferApplicants>, 'unknown'>> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/offers/listing-id/${listingId}`
    )

    return { ok: true, data: res.data.content }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getOffersByListingId')
    return { ok: false, err: 'unknown' }
  }
}

const getActiveOfferByListingId = async (
  listingId: number
): Promise<AdapterResult<Offer, GetActiveOfferByListingIdErrorCodes>> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/offers/listing-id/${listingId}/active`
    )

    if (!res.data.content) {
      return {
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.NotFound,
        statusCode: res.status,
      }
    }

    return { ok: true, data: res.data.content, statusCode: res.status }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getActiveOfferByListingId')
    if (err instanceof AxiosError) {
      return {
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.Unknown,
        statusCode: err.response?.status ?? 500,
      }
    } else {
      return {
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.Unknown,
        statusCode: 500,
      }
    }
  }
}

const getOffersForContact = async (
  contactCode: string
): Promise<
  AdapterResult<OfferWithRentalObjectCode[], 'not-found' | 'unknown'>
> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/contacts/${contactCode}/offers`
    )

    if (res.status == HttpStatusCode.NotFound) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: true, data: res.data.content }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getOffersForContact')
    return { ok: false, err: 'unknown' }
  }
}

const getOfferByContactCodeAndOfferId = async (
  contactCode: string,
  offerId: string
): Promise<AdapterResult<DetailedOffer, 'not-found' | 'unknown'>> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/offers/${offerId}/applicants/${contactCode}`
    )

    if (res.status == HttpStatusCode.NotFound) {
      return { ok: false, err: 'not-found' }
    }
    return { ok: true, data: res.data.content }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getOffersForContact')
    return { ok: false, err: 'unknown' }
  }
}

async function closeOfferByAccept(
  offerId: number
): Promise<AdapterResult<null, 'offer-not-found' | 'unknown'>> {
  const res = await axios.put(
    `${tenantsLeasesServiceUrl}/offers/${offerId}/close-by-accept`
  )

  if (res.status === 200) {
    return { ok: true, data: null }
  }

  if (res.status === 404) {
    return { ok: false, err: 'offer-not-found' }
  }

  return { ok: false, err: 'unknown' }
}

async function closeOfferByDeny(
  offerId: number
): Promise<AdapterResult<null, 'offer-not-found' | 'unknown'>> {
  const res = await axios.put(
    `${tenantsLeasesServiceUrl}/offers/${offerId}/deny`
  )

  if (res.status === 200) {
    return { ok: true, data: null }
  }

  if (res.status === 404) {
    return { ok: false, err: 'offer-not-found' }
  }

  return { ok: false, err: 'unknown' }
}

const handleExpiredOffers = async (): Promise<
  AdapterResult<null | number[], 'unknown'>
> => {
  const res = await axios.put(`${tenantsLeasesServiceUrl}/offers/handleexpired`)

  if (res.status === 200) {
    return { ok: true, data: res.data.content }
  } else {
    return { ok: false, err: 'unknown' }
  }
}

async function updateOfferSentAt(
  offerId: number,
  sentAt: Date
): Promise<AdapterResult<null, 'bad-params' | 'not-found' | 'unknown'>> {
  try {
    const res = await axios.put(
      `${tenantsLeasesServiceUrl}/offers/${offerId}/sent-at`,
      { sentAt }
    )

    if (res.status === 200) {
      return { ok: true, data: null }
    }

    if (res.status === 400) {
      return { ok: false, err: 'bad-params' }
    }

    if (res.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(err, 'leasing-adapter.offers.updateOfferSentAt')
    return { ok: false, err: 'unknown' }
  }
}

export {
  createOffer,
  getOfferByOfferId,
  getOffersByListingId,
  getActiveOfferByListingId,
  getOffersForContact,
  getOfferByContactCodeAndOfferId,
  closeOfferByAccept,
  closeOfferByDeny,
  handleExpiredOffers,
  updateOfferSentAt,
}
