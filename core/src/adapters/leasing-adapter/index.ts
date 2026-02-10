import {
  loggedAxios as axios,
  logger,
  PaginatedResponse,
} from '@onecore/utilities'
import { AxiosError } from 'axios'
import {
  ConsumerReport,
  Contact,
  WaitingListType,
  Tenant,
  leasing,
  Lease,
  IdentityCheckContact,
} from '@onecore/types'
import { z } from 'zod'

import { AdapterResult } from './../types'
import config from '../../common/config'

//todo: move to global config or handle error statuses in middleware
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status < 500 // override Axios throwing errors so that we can handle errors manually
}

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

interface GetLeasesOptions {
  includeUpcomingLeases: boolean
  includeTerminatedLeases: boolean
  includeContacts: boolean
  includeRentInfo?: boolean // defaults to true
}

const getLease = async (
  leaseId: string,
  includeContacts: string | string[] | undefined
): Promise<Lease> => {
  const leaseResponse = await axios(
    tenantsLeasesServiceUrl +
      '/leases/' +
      encodeURIComponent(leaseId) +
      (includeContacts ? '?includeContacts=true' : '')
  )

  return leaseResponse.data.content
}

const getLeases = async (
  leaseIds: string[],
  includeContacts: string | string[] | undefined
) => {
  const uniqueIds = [...new Set(leaseIds)]

  const leaseResults = await Promise.allSettled(
    uniqueIds.map((id) => getLease(id, includeContacts))
  )

  const leases = leaseResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((lease): lease is Lease => lease != null)

  return Object.fromEntries(leases.map((lease) => [lease.leaseId, lease]))
}

const getLeasesForPnr = async (
  nationalRegistrationNumber: string,
  options: GetLeasesOptions
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams({
    includeUpcomingLeases: options.includeUpcomingLeases.toString(),
    includeTerminatedLeases: options.includeTerminatedLeases.toString(),
    includeContacts: options.includeContacts.toString(),
  })

  const leasesResponse = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/for/nationalRegistrationNumber/${nationalRegistrationNumber}?${queryParams.toString()}`
  )

  return leasesResponse.data.content
}

const getLeasesForContactCode = async (
  contactCode: string,
  options: GetLeasesOptions
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams({
    includeUpcomingLeases: options.includeUpcomingLeases.toString(),
    includeTerminatedLeases: options.includeTerminatedLeases.toString(),
    includeContacts: options.includeContacts.toString(),
  })

  const leasesResponse = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/for/contactCode/${contactCode}?${queryParams.toString()}`
  )

  return leasesResponse.data.content
}

const getLeasesForPropertyId = async (
  propertyId: string,
  options: GetLeasesOptions
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams({
    includeUpcomingLeases: options.includeUpcomingLeases.toString(),
    includeTerminatedLeases: options.includeTerminatedLeases.toString(),
    includeContacts: options.includeContacts.toString(),
    includeRentInfo: (options.includeRentInfo !== false).toString(),
  })
  const leasesResponse = await axios(
    `${tenantsLeasesServiceUrl}/leases/for/propertyId/${propertyId}?${queryParams.toString()}`
  )
  return leasesResponse.data.content
}

const getLeasesBatch = async (leaseIds: string[]): Promise<Lease[]> => {
  const pageSize = 500
  let allLeases: Lease[] = []

  for (let i = 0; i < leaseIds.length; i += pageSize) {
    const batch = leaseIds.slice(i, i + pageSize)
    const response = await axios.post(
      `${tenantsLeasesServiceUrl}/leases/batch`,
      { leaseIds: batch }
    )

    allLeases = allLeases.concat(response.data.content)
  }

  return allLeases
}

// TODO: Move move to new microservice governingn organization. for now here just to make it available for the filter in /leases
const getBuildingManagers = async (): Promise<
  { code: string; name: string; district: string }[]
> => {
  const response = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/building-managers`
  )
  return response.data.content
}

const searchLeases = async (
  queryParams: Record<string, string | string[] | undefined>
): Promise<PaginatedResponse<leasing.v1.LeaseSearchResult>> => {
  const params = new URLSearchParams()

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value === undefined) return
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v))
    } else {
      params.append(key, value)
    }
  })

  const response = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/search?${params.toString()}`
  )

  return response.data
}

const getContactForPnr = async (
  nationalRegistrationNumber: string
): Promise<Contact> => {
  const contactResponse = await axios(
    tenantsLeasesServiceUrl +
      '/contacts/by-national-registration-number/' +
      nationalRegistrationNumber
  )

  return contactResponse.data.content
}

const getContactsDataBySearchQuery = async (
  q: string,
  contactType?: 'company' | 'person'
): Promise<
  AdapterResult<
    Array<
      Pick<Contact, 'fullName' | 'contactCode' | 'nationalRegistrationNumber'>
    >,
    unknown
  >
> => {
  try {
    let url = `${tenantsLeasesServiceUrl}/contacts/search?q=${q}`
    if (contactType) {
      url += `&contactType=${contactType}`
    }

    const response = await axios.get<{ content: Array<Contact> }>(url)

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    throw response.data
  } catch (err) {
    logger.error({ err }, 'leasingAdapter.getContactsBySearchQuery')
    return { ok: false, err }
  }
}

const getContactsForIdentityCheck = async (
  page: number,
  limit: number
): Promise<
  AdapterResult<PaginatedResponse<IdentityCheckContact>, 'unknown'>
> => {
  try {
    const response = await axios.get<PaginatedResponse<IdentityCheckContact>>(
      `${tenantsLeasesServiceUrl}/contacts/for-identity-check`,
      { params: { page, limit } }
    )

    if (response.status === 200) {
      return { ok: true, data: response.data }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getContactsForIdentityCheck')
    return { ok: false, err: 'unknown' }
  }
}

const getContacts = async (contactCodes: string[]): Promise<Contact[]> => {
  const pageSize = 500
  let allContacts: Contact[] = []

  for (let i = 0; i < contactCodes.length; i += pageSize) {
    const batch = contactCodes.slice(i, i + pageSize)
    const response = await axios.post(
      `${tenantsLeasesServiceUrl}/contacts/batch`,
      { contactCodes: batch }
    )

    allContacts = allContacts.concat(response.data.content)
  }

  return allContacts
}

const getContactByContactCode = async (
  contactCode: string
): Promise<AdapterResult<Contact, 'not-found' | 'unknown'>> => {
  try {
    const res = await axios.get<{ content: Contact }>(
      `${tenantsLeasesServiceUrl}/contacts/${contactCode}`
    )

    if (!res.data.content) return { ok: false, err: 'not-found' }

    return { ok: true, data: res.data.content }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getContactByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

const getContactCommentsByContactCode = async (
  contactCode: string,
  commentType?: string
): Promise<
  AdapterResult<
    z.infer<typeof leasing.v1.GetContactCommentsResponseSchema>,
    'contact-not-found' | 'unknown'
  >
> => {
  try {
    const params = commentType ? { commentType } : undefined
    const res = await axios.get<{
      content: z.infer<typeof leasing.v1.GetContactCommentsResponseSchema>
    }>(`${tenantsLeasesServiceUrl}/contacts/${contactCode}/comments`, {
      params,
    })

    if (res.status === 404) {
      return { ok: false, err: 'contact-not-found' }
    }

    if (res.status === 200) {
      return { ok: true, data: res.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getContactCommentsByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

const createContactComment = async (
  contactCode: string,
  params: z.infer<typeof leasing.v1.CreateContactCommentRequestSchema>
): Promise<
  AdapterResult<
    z.infer<typeof leasing.v1.ContactCommentSchema>,
    'contact-not-found' | 'unknown'
  >
> => {
  try {
    const res = await axios.post<{
      content: z.infer<typeof leasing.v1.ContactCommentSchema>
    }>(`${tenantsLeasesServiceUrl}/contacts/${contactCode}/comments`, params)

    if (res.status === 404) {
      return { ok: false, err: 'contact-not-found' }
    }

    if (res.status === 200 || res.status === 201) {
      return {
        ok: true,
        data: res.data.content,
        statusCode: res.status,
      }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.createContactComment')
    return { ok: false, err: 'unknown' }
  }
}

const getTenantByContactCode = async (
  contactCode: string
): Promise<
  AdapterResult<
    Tenant,
    | 'unknown'
    | 'no-valid-housing-contract'
    | 'contact-not-found'
    | 'contact-not-tenant'
  >
> => {
  try {
    const res = await axios.get(
      `${tenantsLeasesServiceUrl}/contacts/${contactCode}/tenant`
    )

    if (res.status === 404) return { ok: false, err: 'contact-not-tenant' }

    if (!res.data.content) {
      return { ok: false, err: 'unknown' }
    }

    return { ok: true, data: res.data.content }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getTenantByContactCode')

    if (err instanceof AxiosError) {
      if (err.response?.data?.type === 'contact-leases-not-found') {
        return { ok: false, err: 'contact-not-tenant' }
      }
      return { ok: false, err: err.response?.data?.type }
    }
    return { ok: false, err: 'unknown' }
  }
}

const getContactByPhoneNumber = async (
  phoneNumber: string
): Promise<Contact | undefined> => {
  try {
    const contactResponse = await axios(
      tenantsLeasesServiceUrl + '/contacts/by-phone-number/' + phoneNumber
    )
    return contactResponse.data.content
  } catch {
    return undefined
  }
}

const getCreditInformation = async (
  nationalRegistrationNumber: string
): Promise<ConsumerReport> => {
  const informationResponse = await axios(
    tenantsLeasesServiceUrl +
      '/cas/getConsumerReport/' +
      nationalRegistrationNumber
  )
  return informationResponse.data.content
}

const addApplicantToWaitingList = async (
  contactCode: string,
  waitingListType: WaitingListType
) => {
  const axiosOptions = {
    method: 'POST',
    data: {
      waitingListType: waitingListType,
    },
  }
  return await axios(
    tenantsLeasesServiceUrl + `/contacts/${contactCode}/waitingLists`,
    axiosOptions
  )
}

const resetWaitingList = async (
  contactCode: string,
  waitingListType: WaitingListType
): Promise<AdapterResult<undefined, 'not-in-waiting-list' | 'unknown'>> => {
  try {
    const axiosOptions = {
      method: 'POST',
      data: {
        waitingListType: waitingListType,
      },
    }
    const res = await axios(
      tenantsLeasesServiceUrl + `/contacts/${contactCode}/waitingLists/reset`,
      axiosOptions
    )

    if (res.status == 200) return { ok: true, data: undefined }
    else if (res.status == 404) return { ok: false, err: 'not-in-waiting-list' }

    return { ok: false, err: 'unknown' }
  } catch (error: unknown) {
    logger.error(
      error,
      'Error resetting waiting list for applicant ' + contactCode
    )
    return { ok: false, err: 'unknown' }
  }
}

export type GetApplicationProfileResponseData = z.infer<
  typeof leasing.v1.GetApplicationProfileResponseDataSchema
>

async function getApplicationProfileByContactCode(
  contactCode: string
): Promise<
  AdapterResult<GetApplicationProfileResponseData, 'unknown' | 'not-found'>
> {
  try {
    const response = await axios.get<{
      content: GetApplicationProfileResponseData
    }>(`${tenantsLeasesServiceUrl}/contacts/${contactCode}/application-profile`)

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(err, 'Error getting application profile by contact code:')
    return { ok: false, err: 'unknown' }
  }
}

type CreateOrUpdateApplicationProfileResponseData = z.infer<
  typeof leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema
>

export type CreateOrUpdateApplicationProfileRequestParams = z.infer<
  typeof leasing.v1.CreateOrUpdateApplicationProfileRequestParamsSchema
>

async function createOrUpdateApplicationProfileByContactCode(
  contactCode: string,
  params: CreateOrUpdateApplicationProfileRequestParams
): Promise<
  AdapterResult<
    CreateOrUpdateApplicationProfileResponseData,
    'bad-params' | 'unknown'
  >
> {
  try {
    const response = await axios.post<{
      content: CreateOrUpdateApplicationProfileResponseData
    }>(
      `${tenantsLeasesServiceUrl}/contacts/${contactCode}/application-profile`,
      params
    )

    if (response.status === 200 || response.status === 201) {
      return {
        ok: true,
        data: response.data.content,
        statusCode: response.status,
      }
    }

    if (response.status === 400) {
      return { ok: false, err: 'bad-params' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(
      err,
      `Error create or updating application profile by contact code: ${contactCode}`
    )
    return { ok: false, err: 'unknown' }
  }
}

// Text Content functions
type ListingTextContent = z.infer<typeof leasing.v1.ListingTextContentSchema>
type CreateListingTextContentRequest = z.infer<
  typeof leasing.v1.CreateListingTextContentRequestSchema
>
type UpdateListingTextContentRequest = z.infer<
  typeof leasing.v1.UpdateListingTextContentRequestSchema
>

const getListingTextContentByRentalObjectCode = async (
  rentalObjectCode: string
): Promise<AdapterResult<ListingTextContent, 'not-found' | 'unknown'>> => {
  try {
    const response = await axios.get<{
      content: ListingTextContent
    }>(`${tenantsLeasesServiceUrl}/listing-text-content/${rentalObjectCode}`)

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(
      err,
      'Error getting listing text content by rental object code:'
    )
    return { ok: false, err: 'unknown' }
  }
}

const createListingTextContent = async (
  data: CreateListingTextContentRequest
): Promise<AdapterResult<ListingTextContent, 'conflict' | 'unknown'>> => {
  try {
    const response = await axios.post<{
      content: ListingTextContent
    }>(`${tenantsLeasesServiceUrl}/listing-text-content`, data)

    if (response.status === 201) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 409) {
      return { ok: false, err: 'conflict' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(err, 'Error creating listing text content:')
    return { ok: false, err: 'unknown' }
  }
}

const updateListingTextContent = async (
  rentalObjectCode: string,
  data: UpdateListingTextContentRequest
): Promise<AdapterResult<ListingTextContent, 'not-found' | 'unknown'>> => {
  try {
    const response = await axios.put<{
      content: ListingTextContent
    }>(
      `${tenantsLeasesServiceUrl}/listing-text-content/${rentalObjectCode}`,
      data
    )

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(err, 'Error updating listing text content:')
    return { ok: false, err: 'unknown' }
  }
}

const deleteListingTextContent = async (
  rentalObjectCode: string
): Promise<AdapterResult<void, 'not-found' | 'unknown'>> => {
  try {
    const response = await axios.delete(
      `${tenantsLeasesServiceUrl}/listing-text-content/${rentalObjectCode}`
    )

    if (response.status === 200) {
      return { ok: true, data: undefined }
    }

    if (response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(err, 'Error deleting listing text content:')
    return { ok: false, err: 'unknown' }
  }
}
export type PreliminaryTerminateLeaseRequestParams = z.infer<
  typeof leasing.v1.PreliminaryTerminateLeaseRequestSchema
>

export type PreliminaryTerminateLeaseResponseData = z.infer<
  typeof leasing.v1.PreliminaryTerminateLeaseResponseSchema
>

const preliminaryTerminateLease = async (
  leaseId: string,
  params: PreliminaryTerminateLeaseRequestParams
): Promise<
  AdapterResult<
    PreliminaryTerminateLeaseResponseData,
    | 'lease-not-found'
    | 'tenant-email-missing'
    | 'termination-failed'
    | 'unknown'
  >
> => {
  try {
    const response = await axios.post(
      `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(leaseId)}/preliminary-termination`,
      params
    )

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    const errorType = response.data?.error

    if (response.status === 404) {
      return {
        ok: false,
        err: 'lease-not-found',
      }
    }

    if (response.status === 400 && errorType === 'tenant-email-missing') {
      return {
        ok: false,
        err: 'tenant-email-missing',
      }
    }

    logger.error(
      { status: response.status, data: response.data },
      'Failed to preliminary terminate lease'
    )
    return { ok: false, err: 'termination-failed' }
  } catch (err) {
    if (err instanceof AxiosError && err.response) {
      const errorType = err.response.data?.error
      const status = err.response.status

      if (status === 404) {
        return {
          ok: false,
          err: 'lease-not-found',
        }
      }

      if (status === 400 && errorType === 'tenant-email-missing') {
        return {
          ok: false,
          err: 'tenant-email-missing',
        }
      }

      logger.error(
        { status, error: errorType, leaseId },
        'Error preliminary terminating lease'
      )
      return { ok: false, err: 'termination-failed' }
    }

    logger.error(err, `Error preliminary terminating lease: ${leaseId}`)
    return { ok: false, err: 'unknown' }
  }
}

const getContactsByFilters = async (
  queryParams: Record<string, string | string[] | undefined>
): Promise<AdapterResult<{ content: leasing.v1.ContactInfo[] }, 'unknown'>> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/contacts/from-lease-search`,
      {
        params: queryParams,
        paramsSerializer: {
          indexes: null,
        },
      }
    )

    return { ok: true, data: response.data }
  } catch (err) {
    logger.error({ err }, 'leasingAdapter.getContactsByFilters')
    return { ok: false, err: 'unknown' }
  }
}

interface ExportLeasesResult {
  data: Buffer
  contentType: string
  contentDisposition: string
}

const exportLeasesToExcel = async (
  queryParams: Record<string, string | string[] | undefined>
): Promise<AdapterResult<ExportLeasesResult, 'unknown'>> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/leases/export`,
      {
        params: queryParams,
        responseType: 'arraybuffer',
        paramsSerializer: {
          indexes: null,
        },
      }
    )

    return {
      ok: true,
      data: {
        data: response.data,
        contentType:
          response.headers['content-type'] ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        contentDisposition:
          response.headers['content-disposition'] ||
          `attachment; filename="hyreskontrakt-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    }
  } catch (err) {
    logger.error({ err }, 'leasingAdapter.exportLeasesToExcel')
    return { ok: false, err: 'unknown' }
  }
}

export {
  addApplicantToWaitingList,
  exportLeasesToExcel,
  getContactsByFilters,
  getApplicationProfileByContactCode,
  getContactByContactCode,
  getContactByPhoneNumber,
  getContactCommentsByContactCode,
  getContactForPnr,
  getContactsDataBySearchQuery,
  getContactsForIdentityCheck,
  getContacts,
  getCreditInformation,
  getLeases,
  getLeasesForPnr,
  getLeasesForContactCode,
  getLeasesForPropertyId,
  getLeasesBatch,
  getTenantByContactCode,
  preliminaryTerminateLease,
  resetWaitingList,
  createContactComment,
  createOrUpdateApplicationProfileByContactCode,
  getListingTextContentByRentalObjectCode,
  createListingTextContent,
  updateListingTextContent,
  deleteListingTextContent,
}

export {
  getDetailedApplicantsByListingId,
  setApplicantStatusActive,
  withdrawApplicantByManager,
  withdrawApplicantByUser,
  updateApplicantStatus,
  validatePropertyRentalRules,
  validateResidentialAreaRentalRules,
  getApplicantByContactCodeAndListingId,
  getApplicantsByContactCode,
  getApplicantsAndListingByContactCode,
} from './applicants'

export {
  createLease,
  getLease,
  getLeasesByContactCode,
  getLeasesByRentalObjectCode,
  addLeaseHomeInsurance,
  getLeaseHomeInsurance,
  cancelLeaseHomeInsurance,
  getBuildingManagers,
  searchLeases,
} from './leases'

export {
  applyForListing,
  createNewListing,
  createMultipleListings,
  deleteListing,
  getListingByListingId,
  getActiveListingByRentalObjectCode,
  getListingsWithApplicants,
  updateListingStatus,
  getExpiredListingsWithNoOffers,
  getListings,
} from './listings'

export {
  closeOfferByAccept,
  closeOfferByDeny,
  createOffer,
  getActiveOfferByListingId,
  getOfferByContactCodeAndOfferId,
  getOfferByOfferId,
  getOffersByListingId,
  getOffersForContact,
  handleExpiredOffers,
  updateOfferSentAt,
} from './offers'

export { getCommentThread, addComment, removeComment } from './comments'

export {
  getAllVacantParkingSpaces,
  getParkingSpaceByCode,
  getParkingSpaces,
  getRentalObjectRentByCode,
  getRentalObjectRents,
} from './rental-objects'
