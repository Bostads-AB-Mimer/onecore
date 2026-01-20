import { loggedAxios as axios, logger } from '@onecore/utilities'
import { AxiosError } from 'axios'
import {
  ConsumerReport,
  Contact,
  WaitingListType,
  Tenant,
  leasing,
} from '@onecore/types'
import { z } from 'zod'

import { AdapterResult } from './../types'
import config from '../../common/config'

//todo: move to global config or handle error statuses in middleware
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status < 500 // override Axios throwing errors so that we can handle errors manually
}

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

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

    if (res.status === 404) return { ok: false, err: 'contact-not-tenant' }

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

export {
  addApplicantToWaitingList,
  getApplicationProfileByContactCode,
  getContactByContactCode,
  getContactByPhoneNumber,
  getContactForPnr,
  getContactsDataBySearchQuery,
  getCreditInformation,
  getTenantByContactCode,
  resetWaitingList,
  createOrUpdateApplicationProfileByContactCode,
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
  addLeaseHomeInsuranceRentRow,
  deleteLeaseRentRow,
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
