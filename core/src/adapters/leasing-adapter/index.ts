import { loggedAxios as axios, logger } from '@onecore/utilities'
import { AxiosError } from 'axios'
import {
  ConsumerReport,
  Contact,
  Lease,
  WaitingListType,
  Applicant,
  ApplicantStatus,
  ApplicantWithListing,
  DetailedApplicant,
  Tenant,
  leasing,
} from '@onecore/types'
import { z } from 'zod'

import { AdapterResult } from './../types'
import config from '../../common/config'
import { getListingByListingId } from './listings'
import { getParkingSpaceByCode } from './rental-objects'

//todo: move to global config or handle error statuses in middleware
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status < 500 // override Axios throwing errors so that we can handle errors manually
}

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

interface GetLeasesOptions {
  includeUpcomingLeases: boolean
  includeTerminatedLeases: boolean
  includeContacts: boolean
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
  })
  const leasesResponse = await axios(
    `${tenantsLeasesServiceUrl}/leases/for/propertyId/${propertyId}?${queryParams.toString()}`
  )
  return leasesResponse.data.content
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
  q: string
): Promise<
  AdapterResult<Array<Pick<Contact, 'fullName' | 'contactCode'>>, unknown>
> => {
  try {
    const response = await axios.get<{ content: Array<Contact> }>(
      `${tenantsLeasesServiceUrl}/contacts/search?q=${q}`
    )

    if (response.status === 200) {
      return { ok: true, data: response.data.content }
    }

    throw response.data
  } catch (err) {
    logger.error({ err }, 'leasingAdapter.getContactsBySearchQuery')
    return { ok: false, err }
  }
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

    if (!res.data.content) {
      return { ok: false, err: 'unknown' }
    }

    return { ok: true, data: res.data.content }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getTenantByContactCode')

    if (err instanceof AxiosError)
      return { ok: false, err: err.response?.data?.type }
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

const createLease = async (
  objectId: string,
  contactId: string,
  fromDate: string,
  companyCode: string
): Promise<AdapterResult<string, 'create-lease-failed' | 'unknown'>> => {
  const axiosOptions = {
    method: 'POST',
    data: {
      parkingSpaceId: objectId,
      contactCode: contactId,
      fromDate,
      companyCode,
    },
  }

  const result = await axios(tenantsLeasesServiceUrl + '/leases', axiosOptions)

  if (result.status == 200) {
    return { ok: true, data: result.data.content }
  } else if (
    result.status == 404 &&
    result.data.error === 'Lease cannot be created on this rental object'
  ) {
    logger.error(
      { objectId, contactId, fromDate },
      'Lease could not be created for rental object'
    )
    return { ok: false, err: 'create-lease-failed' }
  } else {
    logger.error(
      { error: result.data.error },
      'Unknown error when creating lease'
    )
    return { ok: false, err: 'unknown' }
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

const getApplicantsByContactCode = async (
  contactCode: string
): Promise<any[] | undefined> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/applicants/${contactCode}/`
    )
    return response.data.content
  } catch (error) {
    logger.error(error, 'Error fetching applicants by contact code:')
    return undefined
  }
}

const getApplicantsAndListingByContactCode = async (
  contactCode: string
): Promise<any[] | undefined> => {
  const applicantsAndListings: ApplicantWithListing[] = []
  try {
    const applicantsResponse = (await getApplicantsByContactCode(
      contactCode
    )) as Applicant[]
    for (const applicant of applicantsResponse) {
      const listingResponse = await getListingByListingId(applicant.listingId)
      if (listingResponse) {
        //also get rental object for the listing
        const rentalObjectResponse = await getParkingSpaceByCode(
          listingResponse.rentalObjectCode
        )
        if (rentalObjectResponse.ok) {
          listingResponse.rentalObject = rentalObjectResponse.data
        } else {
          logger.info(
            { rentalObjectCode: listingResponse.rentalObjectCode },
            'getApplicantsAndListingByContactCode: Could not fetch rental object for listing'
          )
        }

        applicantsAndListings.push({ applicant, listing: listingResponse })
      }
    }
    return applicantsAndListings
  } catch (error) {
    logger.error(
      error,
      'Error fetching applicants and listings by contact code:'
    )
    return undefined
  }
}

const getApplicantByContactCodeAndListingId = async (
  contactCode: string,
  listingId: string
): Promise<any | undefined> => {
  try {
    return await axios.get(
      `${tenantsLeasesServiceUrl}/applicants/${contactCode}/${listingId}`
    )
  } catch (error) {
    logger.error(
      error,
      'Error fetching applicant by contact code and rental object code'
    )
    return undefined
  }
}

const getDetailedApplicantsByListingId = async (
  listingId: number
): Promise<AdapterResult<DetailedApplicant[], 'unknown' | 'not-found'>> => {
  try {
    const response = await axios(
      `${tenantsLeasesServiceUrl}/listing/${listingId}/applicants/details`
    )

    return { ok: true, data: response.data.content }
  } catch (error) {
    logger.error(error, 'Error fetching detailed applicant data by listing id')

    if (!(error instanceof AxiosError)) {
      return { ok: false, err: 'unknown' }
    }

    if (error.response?.status === 404) {
      return { ok: false, err: 'not-found' }
    } else {
      return { ok: false, err: 'unknown' }
    }
  }
}

const setApplicantStatusActive = async (
  applicantId: string,
  contactCode: string,
  applicationType?: 'Replace' | 'Additional'
): Promise<any> => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${applicantId}/status`,
      {
        status: ApplicantStatus.Active,
        contactCode: contactCode,
        applicationType,
      }
    )
    return response.data
  } catch (error) {
    logger.error(
      error,
      `Error setting applicantStatus active on user with contactcode ${contactCode}`
    )
    throw new Error(`Failed to update status for applicant ${applicantId}`)
  }
}

const withdrawApplicantByManager = async (
  applicantId: string
): Promise<any> => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${applicantId}/status`,
      { status: ApplicantStatus.WithdrawnByManager }
    )
    return response.data
  } catch (error) {
    logger.error(error, 'Error patching applicant status:')
    throw new Error(`Failed to update status for applicant ${applicantId}`)
  }
}

const withdrawApplicantByUser = async (
  applicantId: string,
  contactCode: string
): Promise<any> => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${applicantId}/status`,
      { status: ApplicantStatus.WithdrawnByUser, contactCode: contactCode }
    )
    return response.data
  } catch (error) {
    logger.error(error, 'Error withdrawing applicant by user:')
    return undefined
  }
}

const updateApplicantStatus = async (params: {
  contactCode: string
  applicantId: number
  status: ApplicantStatus
}) => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${params.applicantId}/status`,
      params
    )
    return response.data
  } catch (err) {
    logger.error(err, 'Error updating applicant status')
    throw err
  }
}

const validateResidentialAreaRentalRules = async (
  contactCode: string,
  districtCode: string
): Promise<
  AdapterResult<
    { reason: string; applicationType: 'Replace' | 'Additional' },
    {
      tag: 'no-housing-contract-in-the-area' | 'not-found' | 'unknown'
      data: unknown
    }
  >
> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/applicants/validateResidentialAreaRentalRules/${contactCode}/${districtCode}`
    )
    if (res.status === 403) {
      return {
        ok: false,
        err: { tag: 'no-housing-contract-in-the-area', data: res.data },
      }
    }

    if (res.status === 404) {
      return {
        ok: false,
        err: { tag: 'not-found', data: res.data },
      }
    }

    if (res.status !== 200) {
      return { ok: false, err: { tag: 'unknown', data: res.data } }
    }

    return { ok: true, data: res.data }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.validateResidentialAreaRentalRules')
    return { ok: false, err: { tag: 'unknown', data: err } }
  }
}

const validatePropertyRentalRules = async (
  contactCode: string,
  rentalObjectCode: string
): Promise<
  AdapterResult<
    { reason: string; applicationType: 'Replace' | 'Additional' },
    {
      tag:
        | 'not-tenant-in-the-property'
        | 'not-a-parking-space'
        | 'not-found'
        | 'unknown'
      data: unknown
    }
  >
> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/applicants/validatePropertyRentalRules/${contactCode}/${rentalObjectCode}`
    )

    if (res.status === 404) {
      return { ok: false, err: { tag: 'not-found', data: res.data } }
    }

    if (res.status === 400) {
      return { ok: false, err: { tag: 'not-a-parking-space', data: res.data } }
    }

    if (res.status === 403) {
      return {
        ok: false,
        err: { tag: 'not-tenant-in-the-property', data: res.data },
      }
    }

    return { ok: true, data: res.data }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.validatePropertyRentalRules')
    return { ok: false, err: { tag: 'unknown', data: err } }
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

export {
  addApplicantToWaitingList,
  createLease,
  getApplicantByContactCodeAndListingId,
  getApplicantsAndListingByContactCode,
  getApplicantsByContactCode,
  getApplicationProfileByContactCode,
  getContactByContactCode,
  getContactByPhoneNumber,
  getContactForPnr,
  getContactsDataBySearchQuery,
  getCreditInformation,
  getLease,
  getLeasesForPnr,
  getLeasesForContactCode,
  getLeasesForPropertyId,
  getDetailedApplicantsByListingId,
  getTenantByContactCode,
  resetWaitingList,
  setApplicantStatusActive,
  createOrUpdateApplicationProfileByContactCode,
  updateApplicantStatus,
  validatePropertyRentalRules,
  validateResidentialAreaRentalRules,
  withdrawApplicantByManager,
  withdrawApplicantByUser,
}

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
  getParkingSpaceByRentalObjectCode,
  getParkingSpaceByCode,
  getParkingSpaces,
} from './rental-objects'
