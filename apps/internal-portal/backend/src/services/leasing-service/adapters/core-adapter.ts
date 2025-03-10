import {
  Contact,
  CreateNoteOfInterestErrorCodes,
  DetailedApplicant,
  GetActiveOfferByListingIdErrorCodes,
  InternalParkingSpaceSyncSuccessResponse,
  Listing,
  ListingStatus,
  Offer,
  OfferWithOfferApplicants,
  ReplyToOfferErrorCodes,
  Tenant,
} from 'onecore-types'
import { AxiosError, HttpStatusCode } from 'axios'

import Config from '../../../common/config'
import { getFromCore } from '../../common/adapters/core-adapter'

const coreBaseUrl = Config.core.url

type AdapterResult<T, E> =
  | { ok: false; err: E; statusCode: number }
  | { ok: true; data: T }

const getListingsWithApplicants = async (
  querystring: string
): Promise<
  AdapterResult<Array<Listing | (Listing & { offer: Offer })>, 'unknown'>
> => {
  try {
    const url = `${coreBaseUrl}/listings-with-applicants?${querystring}`
    const listingsResponse = await getFromCore<{ content: Array<Listing> }>({
      method: 'get',
      url: url,
    })

    if (querystring !== 'type=offered') {
      return { ok: true, data: listingsResponse.data.content }
    }

    const withOffers = await Promise.all(
      listingsResponse.data.content.map(async (listing) => {
        const offer = await getActiveOfferByListingId(listing.id)
        if (!offer.ok) {
          throw new Error('Failed to get offer')
        }

        return { ...listing, offer: offer.data }
      })
    )

    return { ok: true, data: withOffers }
  } catch (err) {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const getListingWithApplicants = async (
  listingId: string
): Promise<
  Listing & {
    applicants: Array<DetailedApplicant>
    offers: Array<OfferWithOfferApplicants>
  }
> => {
  const listing: Promise<Listing> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listing/${listingId}`,
  }).then((res) => res.data.content)

  const applicants: Promise<DetailedApplicant[]> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listing/${listingId}/applicants/details`,
  }).then((res) => res.data.content)

  const offers: Promise<Array<OfferWithOfferApplicants>> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/offers/listing-id/${listingId}`,
  }).then((res) => res.data.content)

  const [listingResult, applicantsResult, offersResult] = await Promise.all([
    listing,
    applicants,
    offers,
  ])

  return {
    ...listingResult,
    applicants: applicantsResult || [],
    offers: offersResult,
  }
}

const removeApplicant = async (applicantId: string) => {
  const response = await getFromCore({
    method: 'delete',
    url: `${coreBaseUrl}/applicants/${applicantId}/by-manager`,
  })

  return response.data
}

const getContactsDataBySearchQuery = async (
  q: string
): Promise<
  AdapterResult<Array<Pick<Contact, 'fullName' | 'contactCode'>>, unknown>
> => {
  try {
    const result = await getFromCore<{ content: Array<Contact> }>({
      method: 'get',
      url: `${coreBaseUrl}/contacts/search?q=${q}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    return { ok: false, err, statusCode: 500 }
  }
}

const getTenantByContactCode = async (
  contactCode: string
): Promise<
  AdapterResult<
    Tenant,
    unknown | 'no-valid-housing-contract' | 'contact-not-found'
  >
> => {
  try {
    const result = await getFromCore<{ content: Tenant }>({
      method: 'get',
      url: `${coreBaseUrl}/tenants/contactCode/${contactCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 500) {
      return { ok: false, err: err.response?.data?.type, statusCode: 500 }
    }

    return { ok: false, err, statusCode: 500 }
  }
}

const validatePropertyRentalRules = async (
  contactCode: string,
  rentalObjectCode: string
): Promise<
  AdapterResult<
    { applicationType: 'Replace' | 'Additional' },
    'no-contract-in-area-or-property' | 'unknown'
  >
> => {
  try {
    const result = await getFromCore<{
      content: { applicationType: 'Replace' | 'Additional' }
    }>({
      method: 'get',
      url: `${coreBaseUrl}/applicants/validate-rental-rules/property/${contactCode}/${rentalObjectCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 403) {
      return {
        ok: false,
        err: 'no-contract-in-area-or-property',
        statusCode: 403,
      }
    } else {
      return { ok: false, err: 'unknown', statusCode: 500 }
    }
  }
}

const validateResidentialAreaRentalRules = async (
  contactCode: string,
  districtCode: string
): Promise<
  AdapterResult<
    { applicationType: 'Replace' | 'Additional' },
    'no-contract-in-area-or-property' | 'unknown'
  >
> => {
  try {
    const result = await getFromCore<{
      content: { applicationType: 'Replace' | 'Additional' }
    }>({
      method: 'get',
      url: `${coreBaseUrl}/applicants/validate-rental-rules/residential-area/${contactCode}/${districtCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 403) {
      return {
        ok: false,
        err: 'no-contract-in-area-or-property',
        statusCode: 403,
      }
    } else {
      return { ok: false, err: 'unknown', statusCode: 500 }
    }
  }
}

const createNoteOfInterestForInternalParkingSpace = async (params: {
  parkingSpaceId: string
  applicationType: string
  contactCode: string
}): Promise<
  AdapterResult<unknown, 'internal-credit-check-failed' | 'unknown'>
> => {
  try {
    // todo: fix type
    const response = await getFromCore<any>({
      method: 'post',
      url: `${coreBaseUrl}/parkingspaces/${params.parkingSpaceId}/noteofinterests`,
      data: params,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    //todo: refactor to proxy error code and http status
    if (
      err instanceof AxiosError &&
      err.response?.status === HttpStatusCode.BadRequest &&
      err.response.data.content.errorCode ===
        CreateNoteOfInterestErrorCodes.InternalCreditCheckFailed
    ) {
      return {
        ok: false,
        err: CreateNoteOfInterestErrorCodes.InternalCreditCheckFailed,
        statusCode: 400,
      }
    }
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const createOffer = async (params: {
  listingId: string
}): Promise<AdapterResult<unknown, unknown>> => {
  try {
    const response = await getFromCore<any>({
      method: 'post',
      url: `${coreBaseUrl}/listings/${params.listingId}/offers`,
      data: params,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    return { ok: false, err, statusCode: 500 }
  }
}

const syncInternalParkingSpacesFromXpand = async (): Promise<
  AdapterResult<InternalParkingSpaceSyncSuccessResponse, 'unknown'>
> => {
  try {
    const response = await getFromCore<{
      content: InternalParkingSpaceSyncSuccessResponse
    }>({
      method: 'post',
      url: `${coreBaseUrl}/listings/sync-internal-from-xpand`,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const deleteListing = async (
  listingId: number
): Promise<AdapterResult<null, 'conflict' | 'unknown'>> => {
  try {
    await getFromCore<{
      content: InternalParkingSpaceSyncSuccessResponse
    }>({
      method: 'delete',
      url: `${coreBaseUrl}/listings/${listingId}`,
    })

    return { ok: true, data: null }
  } catch (err) {
    if (err instanceof AxiosError) {
      if (err.status === 409) {
        return { ok: false, err: 'conflict', statusCode: 409 }
      }
    }

    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const closeListing = async (
  listingId: number
): Promise<AdapterResult<null, 'unknown'>> => {
  try {
    await getFromCore({
      method: 'put',
      url: `${coreBaseUrl}/listings/${listingId}/status`,
      data: { status: ListingStatus.Closed },
    })

    return { ok: true, data: null }
  } catch (err) {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const acceptOffer = async (
  offerId: string
): Promise<AdapterResult<Array<Listing>, ReplyToOfferErrorCodes>> => {
  try {
    const url = `${coreBaseUrl}/offers/${offerId}/accept`
    const response = await getFromCore({
      method: 'post',
      url: url,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    if (
      err instanceof AxiosError &&
      err.response?.status &&
      err.response.data.error
    ) {
      return {
        ok: false,
        err: err.response.data.error,
        statusCode: err.response.status,
      }
    } else {
      return { ok: false, err: ReplyToOfferErrorCodes.Unknown, statusCode: 500 }
    }
  }
}

const denyOffer = async (
  offerId: string
): Promise<AdapterResult<Array<Listing>, 'unknown'>> => {
  try {
    const url = `${coreBaseUrl}/offers/${offerId}/deny`
    const response = await getFromCore({
      method: 'post',
      url: url,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    if (
      err instanceof AxiosError &&
      err.response?.status &&
      err.response.data.error
    ) {
      return {
        ok: false,
        err: err.response.data.error,
        statusCode: err.response.status,
      }
    } else {
      return { ok: false, err: ReplyToOfferErrorCodes.Unknown, statusCode: 500 }
    }
  }
}

const getActiveOfferByListingId = async (
  listingId: number
): Promise<AdapterResult<Offer, GetActiveOfferByListingIdErrorCodes>> => {
  try {
    const result = await getFromCore<{ content: Offer }>({
      method: 'get',
      url: `${coreBaseUrl}/offers/listing-id/${listingId}/active`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    if (!(err instanceof AxiosError)) {
      return {
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.Unknown,
        statusCode: 500,
      }
    }

    if (err.response?.status === 404) {
      return {
        ok: false,
        err: GetActiveOfferByListingIdErrorCodes.NotFound,
        statusCode: 404,
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

export {
  getListingsWithApplicants,
  getListingWithApplicants,
  removeApplicant,
  getContactsDataBySearchQuery,
  getTenantByContactCode,
  createNoteOfInterestForInternalParkingSpace,
  validatePropertyRentalRules,
  validateResidentialAreaRentalRules,
  syncInternalParkingSpacesFromXpand,
  createOffer,
  deleteListing,
  closeListing,
  acceptOffer,
  denyOffer,
  getActiveOfferByListingId,
}
