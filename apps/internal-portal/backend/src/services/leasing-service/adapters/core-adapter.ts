import { AxiosError, HttpStatusCode } from 'axios'
import {
  Contact,
  CreateNoteOfInterestErrorCodes,
  DetailedApplicant,
  GetActiveOfferByListingIdErrorCodes,
  Listing,
  ListingStatus,
  Offer,
  OfferWithOfferApplicants,
  ReplyToOfferErrorCodes,
  Tenant,
  leasing,
  schemas,
  Comment,
  CommentThread,
  CommentThreadId,
  RentalObject,
  Invoice,
  Lease,
} from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import Config from '../../../common/config'
import { getFromCore } from '../../common/adapters/core-adapter'
import { AdapterResult } from '@/services/types'

const coreBaseUrl = Config.core.url

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

    const listings = listingsResponse.data?.content

    listings.sort((a, b) => {
      const dateA = new Date(a.publishedFrom).getTime()
      const dateB = new Date(b.publishedFrom).getTime()
      return dateB - dateA
    })

    if (querystring !== 'type=offered') {
      return { ok: true, data: listings }
    }

    const withOffers = await Promise.all(
      listings.map(async (listing) => {
        const offer = await getActiveOfferByListingId(listing.id)
        if (!offer.ok) {
          throw new Error('Failed to get offer')
        }

        return { ...listing, offer: offer.data }
      })
    )

    return { ok: true, data: withOffers }
  } catch {
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
    url: `${coreBaseUrl}/listings/${listingId}`,
  }).then((res) => res.data.content)

  const applicants: Promise<DetailedApplicant[]> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listings/${listingId}/applicants/details`,
  }).then((res) => res.data.content)

  const offers: Promise<Array<OfferWithOfferApplicants>> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/offers/by-listing-id/${listingId}`,
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
    | unknown
    | 'no-valid-housing-contract'
    | 'contact-not-found'
    | 'contact-not-tenant'
  >
> => {
  try {
    const result = await getFromCore<{ content: Tenant }>({
      method: 'get',
      url: `${coreBaseUrl}/tenants/by-contact-code/${contactCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 500) {
      return { ok: false, err: err.response?.data?.type, statusCode: 500 }
    }

    return { ok: false, err, statusCode: 500 }
  }
}

const getContactByContactCode = async (
  contactCode: string
): Promise<AdapterResult<Contact, unknown>> => {
  try {
    const result = await getFromCore<{ content: Contact }>({
      method: 'get',
      url: `${coreBaseUrl}/contacts/${contactCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    return { ok: false, err, statusCode: 500 }
  }
}

const getContactByNationalRegistrationNumber = async (
  pnr: string
): Promise<AdapterResult<Contact, unknown>> => {
  try {
    const result = await getFromCore<{ content: Contact }>({
      method: 'get',
      url: `${coreBaseUrl}/contacts/by-pnr/${pnr}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
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
      url: `${coreBaseUrl}/parking-spaces/${params.parkingSpaceId}/note-of-interests`,
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

const createListings = async (
  listingData: Omit<Listing, 'id' | 'rentalObject'>
): Promise<AdapterResult<Listing, 'conflict' | 'unknown'>> => {
  try {
    const response = await getFromCore<{ content: Listing }>({
      method: 'post',
      url: `${coreBaseUrl}/listings`,
      data: listingData,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    const axiosError = err as AxiosError
    if (axiosError.response?.status === HttpStatusCode.Conflict) {
      return { ok: false, err: 'conflict', statusCode: 409 }
    }
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const createMultipleListings = async (
  listingsData: Array<Omit<Listing, 'id' | 'rentalObject'>>
): Promise<AdapterResult<Array<Listing>, 'partial-failure' | 'unknown'>> => {
  try {
    const response = await getFromCore<{ content: Array<Listing> }>({
      method: 'post',
      url: `${coreBaseUrl}/listings/batch`,
      data: { listings: listingsData },
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    const axiosError = err as AxiosError
    if (axiosError.response?.status === 207) {
      return { ok: false, err: 'partial-failure', statusCode: 207 }
    }
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const deleteListing = async (
  listingId: number
): Promise<AdapterResult<null, 'conflict' | 'unknown'>> => {
  try {
    await getFromCore({
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
  } catch {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const expireListing = async (
  listingId: number
): Promise<AdapterResult<null, 'unknown'>> => {
  try {
    await getFromCore({
      method: 'put',
      url: `${coreBaseUrl}/listings/${listingId}/status`,
      data: { status: ListingStatus.Expired },
    })

    return { ok: true, data: null }
  } catch {
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
      url: `${coreBaseUrl}/offers/by-listing-id/${listingId}/active`,
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

type ApplicationProfile = z.infer<typeof schemas.v1.ApplicationProfileSchema>

enum GetApplicationProfileByContactCodeErrorCodes {
  NotFound = 'not-found',
  Unknown = 'unknown',
}

const getApplicationProfileByContactCode = async (
  contactCode: string
): Promise<AdapterResult<ApplicationProfile, unknown>> => {
  try {
    const {
      data: { content: applicationProfile },
    } = await getFromCore<{
      content: ApplicationProfile
    }>({
      method: 'get',
      url: `${coreBaseUrl}/contacts/${contactCode}/application-profile`,
    })

    return {
      ok: true,
      data: applicationProfile,
    }
  } catch (error) {
    if (!(error instanceof AxiosError)) {
      return {
        ok: false,
        err: GetApplicationProfileByContactCodeErrorCodes.Unknown,
        statusCode: 500,
      }
    }
    if (error.response?.status === 404) {
      return {
        ok: false,
        err: GetApplicationProfileByContactCodeErrorCodes.NotFound,
        statusCode: 404,
      }
    } else {
      return {
        ok: false,
        err: GetApplicationProfileByContactCodeErrorCodes.Unknown,
        statusCode: 500,
      }
    }
  }
}

type CreateOrUpdateApplicationProfileRequestParams = z.infer<
  typeof leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema
>

type CreateOrUpdateApplicationProfileResponseData = z.infer<
  typeof leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema
>

const createOrUpdateApplicationProfile = async (
  contactCode: string,
  profileCommand: CreateOrUpdateApplicationProfileRequestParams
): Promise<
  AdapterResult<CreateOrUpdateApplicationProfileResponseData, unknown>
> => {
  try {
    const response = await getFromCore<any>({
      method: 'post',
      url: `${coreBaseUrl}/contacts/${contactCode}/application-profile/admin`,
      data: profileCommand,
    })

    return { ok: true, data: response.data.content }
  } catch {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const getCommentThread = async (
  threadId: CommentThreadId
): Promise<AdapterResult<CommentThread, 'unknown'>> => {
  try {
    const response = await getFromCore<{ content: CommentThread }>({
      method: 'get',
      url: `${coreBaseUrl}/comments/${threadId.targetType}/thread/${threadId.targetId}`,
    })

    return { ok: true, data: response.data.content }
  } catch {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

type AddCommentRequest = z.infer<
  typeof leasing.v1.AddCommentRequestParamsSchema
>

const addComment = async (
  threadId: CommentThreadId,
  comment: AddCommentRequest
): Promise<AdapterResult<Comment, 'unknown'>> => {
  try {
    const response = await getFromCore<{ content: Comment }>({
      method: 'post',
      url: `${coreBaseUrl}/comments/${threadId.targetType}/thread/${threadId.targetId}`,
      data: comment,
    })
    return { ok: true, data: response.data.content }
  } catch {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const removeComment = async (
  threadId: CommentThreadId,
  commentId: number
): Promise<AdapterResult<void, 'unknown' | 'not-found'>> => {
  try {
    const response = await getFromCore({
      method: 'delete',
      url: `${coreBaseUrl}/comments/${threadId.targetType}/thread/${threadId.targetId}/${commentId}`,
    })

    return { ok: true, data: response.data.content }
  } catch {
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

const getVacantParkingSpaces = async (): Promise<
  AdapterResult<RentalObject[], unknown>
> => {
  try {
    const response = await getFromCore<{ content: RentalObject[] }>({
      method: 'get',
      url: `${coreBaseUrl}/vacant-parkingspaces`,
    })
    return { ok: true, data: response.data.content }
  } catch (e) {
    if (e instanceof AxiosError && e.response?.status === 401) {
      return { ok: false, err: 'unauthorized', statusCode: 401 }
    }
    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

async function getInvoicesByContactCode(
  contactCode: string
): Promise<AdapterResult<Invoice[], 'not-found' | 'unknown'>> {
  const response = await getFromCore<{ content: { data: Invoice[] } }>({
    method: 'get',
    url: `${coreBaseUrl}/invoices/by-contact-code/${contactCode}`,
  })

  if (response.status === 404) {
    return { ok: false, err: 'not-found', statusCode: 404 }
  }

  if (response.status !== 200) {
    logger.error(response.data, 'core-adapter.getInvoicesByContactCode')
    return { ok: false, err: 'unknown', statusCode: 500 }
  }

  return { ok: true, data: response.data.content.data }
}

async function getLeasesByContactCode(contactCode: string) {
  const response = await getFromCore<{ content: Lease[] }>({
    method: 'get',
    url: `${coreBaseUrl}/leases/by-contact-code/${contactCode}`,
  })

  if (response.status === 404) {
    return { ok: false, err: 'not-found', statusCode: 404 }
  }

  if (response.status !== 200) {
    logger.error(response.data, 'core-adapter.getLeasesByContactCode')
    return { ok: false, err: 'unknown', statusCode: 500 }
  }

  return { ok: true, data: response.data.content }
}

export {
  addComment,
  removeComment,
  getListingsWithApplicants,
  getListingWithApplicants,
  removeApplicant,
  getCommentThread,
  getContactsDataBySearchQuery,
  getTenantByContactCode,
  getContactByContactCode,
  getContactByNationalRegistrationNumber,
  createListings,
  createMultipleListings,
  createNoteOfInterestForInternalParkingSpace,
  validatePropertyRentalRules,
  validateResidentialAreaRentalRules,
  createOffer,
  deleteListing,
  closeListing,
  expireListing,
  acceptOffer,
  denyOffer,
  getActiveOfferByListingId,
  getApplicationProfileByContactCode,
  createOrUpdateApplicationProfile,
  getVacantParkingSpaces,
  getInvoicesByContactCode,
  getLeasesByContactCode,
}
