import { loggedAxios as axios, logger } from 'onecore-utilities'
import { AxiosError, HttpStatusCode } from 'axios'
import dayjs from 'dayjs'
import {
  ConsumerReport,
  Contact,
  Invoice,
  InvoiceTransactionType,
  Lease,
  WaitingList,
  Listing,
  Applicant,
  ApplicantStatus,
  ApplicantWithListing,
  Offer,
  DetailedApplicant,
  OfferWithRentalObjectCode,
  DetailedOffer,
  Tenant,
  InternalParkingSpaceSyncSuccessResponse,
  CreateOfferParams,
  OfferWithOfferApplicants,
  GetActiveOfferByListingIdErrorCodes,
} from 'onecore-types'

import config from '../common/config'
import { AdapterResult } from './types'

//todo: move to global config or handle error statuses in middleware
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status < 500 // override Axios throwing errors so that we can handle errors manually
}

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

const getLease = async (
  leaseId: string,
  includeContacts: string | string[] | undefined
): Promise<Lease> => {
  const leaseResponse = await axios(
    tenantsLeasesServiceUrl +
      '/leases/' +
      leaseId +
      (includeContacts ? '?includeContacts=true' : '')
  )

  return leaseResponse.data.content
}

const getLeasesForPnr = async (
  nationalRegistrationNumber: string,
  includeTerminatedLeases: string | string[] | undefined,
  includeContacts: string | string[] | undefined
): Promise<Lease[]> => {
  const leasesResponse = await axios(
    tenantsLeasesServiceUrl +
      '/leases/for/nationalRegistrationNumber/' +
      nationalRegistrationNumber +
      (includeContacts ? '?includeContacts=true' : '')
  )
  return leasesResponse.data.content
}

const getLeasesForPropertyId = async (
  propertyId: string,
  includeTerminatedLeases: string | string[] | undefined,
  includeContacts: string | string[] | undefined
): Promise<Lease[]> => {
  const leasesResponse = await axios(
    tenantsLeasesServiceUrl +
      '/leases/for/propertyId/' +
      propertyId +
      (includeContacts ? '?includeContacts=true' : '')
  )
  return leasesResponse.data.content
}

const getContactForPnr = async (
  nationalRegistrationNumber: string
): Promise<Contact> => {
  const contactResponse = await axios(
    tenantsLeasesServiceUrl +
      '/contact/nationalRegistrationNumber/' +
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

const getContact = async (
  contactCode: string
): Promise<AdapterResult<Contact, 'not-found' | 'unknown'>> => {
  try {
    const res = await axios<{ content?: Contact }>(
      tenantsLeasesServiceUrl + '/contact/contactCode/' + contactCode
    )

    if (res.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    if (res.status === 200 && res.data.content) {
      return { ok: true, data: res.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (error) {
    return { ok: false, err: 'unknown' }
  }
}

const getContactByContactCode = async (
  contactCode: string
): Promise<AdapterResult<Contact, 'not-found' | 'unknown'>> => {
  try {
    const res = await axios.get<{ content: Contact }>(
      `${tenantsLeasesServiceUrl}/contact/contactCode/${contactCode}`
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
): Promise<AdapterResult<Tenant, 'unknown'>> => {
  try {
    const res = await axios.get(
      `${tenantsLeasesServiceUrl}/tenants/contactCode/${contactCode}`
    )

    if (!res.data.content) return { ok: false, err: 'unknown' }

    return { ok: true, data: res.data.content }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getTenantByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

const getContactByPhoneNumber = async (
  phoneNumber: string
): Promise<Contact | undefined> => {
  try {
    const contactResponse = await axios(
      tenantsLeasesServiceUrl + '/contact/phoneNumber/' + phoneNumber
    )
    return contactResponse.data.content
  } catch (error) {
    return undefined
  }
}

const createLease = async (
  objectId: string,
  contactId: string,
  fromDate: string,
  companyCode: string
) => {
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

  return result.data.content
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

const getInternalCreditInformation = async (
  contactCode: string
): Promise<boolean> => {
  const result = await axios(
    tenantsLeasesServiceUrl + '/contact/invoices/contactCode/' + contactCode
  )

  const invoices = result.data.content as Invoice[] | undefined
  const oneDayMs = 24 * 60 * 60 * 1000
  const sixMonthsMs = 182 * oneDayMs

  let hasDebtCollection = false

  if (invoices) {
    hasDebtCollection = invoices.some((invoice: Invoice) => {
      return (
        (invoice.transactionType === InvoiceTransactionType.Reminder ||
          invoice.transactionType === InvoiceTransactionType.DebtCollection) &&
        -dayjs(invoice.expirationDate).diff() < sixMonthsMs
      )
    })
  }

  return !hasDebtCollection
}

const getWaitingList = async (
  nationalRegistrationNumber: string
): Promise<WaitingList[]> => {
  const response = await axios(
    tenantsLeasesServiceUrl +
      '/contact/waitingList/' +
      nationalRegistrationNumber
  )
  return response.data.content
}

const addApplicantToWaitingList = async (
  nationalRegistrationNumber: string,
  contactCode: string,
  waitingListTypeCaption: string
) => {
  const axiosOptions = {
    method: 'POST',
    data: {
      contactCode: contactCode,
      waitingListTypeCaption: waitingListTypeCaption,
    },
  }
  return await axios(
    tenantsLeasesServiceUrl +
      '/contact/waitingList/' +
      nationalRegistrationNumber,
    axiosOptions
  )
}

const resetWaitingList = async (
  nationalRegistrationNumber: string,
  contactCode: string,
  waitingListTypeCaption: string
): Promise<AdapterResult<undefined, 'not-in-waiting-list' | 'unknown'>> => {
  try {
    const axiosOptions = {
      method: 'POST',
      data: {
        contactCode: contactCode,
        waitingListTypeCaption: waitingListTypeCaption,
      },
    }
    const res = await axios(
      tenantsLeasesServiceUrl +
        '/contact/waitingList/' +
        nationalRegistrationNumber +
        '/reset',
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

const createNewListing = async (
  listingData: Listing
): Promise<AdapterResult<Listing, 'conflict' | 'unknown'>> => {
  try {
    const response = await axios.post(
      `${tenantsLeasesServiceUrl}/listings`,
      listingData
    )

    if (response.status === HttpStatusCode.Conflict) {
      return { ok: false, err: 'conflict' }
    }

    if (response.status === HttpStatusCode.Created) {
      return { ok: true, data: response.data.content }
    }

    return { ok: false, err: 'unknown' }
  } catch (error) {
    logger.error(error, 'Error creating new listing:')
    return { ok: false, err: 'unknown' }
  }
}

const applyForListing = async (
  applicantData: Omit<Applicant, 'id'>
): Promise<AdapterResult<Applicant, 'conflict' | 'unknown'>> => {
  try {
    const res = await axios.post(
      `${tenantsLeasesServiceUrl}/listings/apply`,
      applicantData
    )

    if (res.status === HttpStatusCode.Conflict) {
      return { ok: false, err: 'conflict' }
    }

    return { ok: true, data: res.data.content }
  } catch (error) {
    logger.error(error, 'Error applying for listing:', error)
    return { ok: false, err: 'unknown' }
  }
}

const getListingByListingId = async (
  listingId: number
): Promise<Listing | undefined> => {
  try {
    const result = await axios.get(
      `${tenantsLeasesServiceUrl}/listings/by-id/${listingId}`
    )
    return result.data.content
  } catch (error) {
    logger.error(error, 'Error fetching listing by rental object code')
    return undefined
  }
}

const getListingByRentalObjectCode = async (
  rentalObjectCode: string
): Promise<AdapterResult<Listing | undefined, 'not-found' | 'unknown'>> => {
  try {
    const res = await axios.get(
      `${tenantsLeasesServiceUrl}/listings/by-code/${rentalObjectCode}`
    )

    if (res.status == HttpStatusCode.NotFound) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: true, data: res.data.content }
  } catch (error) {
    logger.error(error, 'Error fetching listing by rental object code:', error)
    return { ok: false, err: 'unknown' }
  }
}

const getListingsWithApplicants = async (
  querystring: string
): Promise<AdapterResult<Listing[], 'unknown'>> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/listings-with-applicants?${querystring}`
    )
    return { ok: true, data: response.data.content }
  } catch (error) {
    logger.error(error, 'Error fetching listings with applicants:')
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
        applicantsAndListings.push({ applicant, listing: listingResponse })
      }
    }
    return applicantsAndListings
  } catch (error) {
    logger.error(
      error,
      'Error fetching applicants and listings by contact code:',
      error
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

// TODO: This function does not actually get the listing. Rename and describe function?
const getListingByIdWithDetailedApplicants = async (
  listingId: string
): Promise<DetailedApplicant[] | undefined> => {
  try {
    const response = await axios(
      `${tenantsLeasesServiceUrl}/listing/${listingId}/applicants/details`
    )
    return response.data.content
  } catch (error) {
    logger.error(
      error,
      'Error fetching listing with detailed applicant data:',
      error
    )
    return undefined
  }
}

const setApplicantStatusActive = async (
  applicantId: string,
  contactCode: string
): Promise<any> => {
  try {
    const response = await axios.patch(
      `${tenantsLeasesServiceUrl}/applicants/${applicantId}/status`,
      { status: ApplicantStatus.Active, contactCode: contactCode }
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
    logger.error(error, 'Error patching applicant status:', error)
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
    logger.error(error, 'Error withdrawing applicant by user:', error)
    return undefined
  }
}

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

const syncInternalParkingSpacesFromXpand = async () => {
  try {
    const res = await axios.post<{
      content: InternalParkingSpaceSyncSuccessResponse
    }>(`${tenantsLeasesServiceUrl}/listings/sync-internal-from-xpand`)

    if (res.status !== 200) {
      return { ok: false, err: 'unknown' } as const
    }

    return { ok: true, data: res.data.content } as const
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.syncInternalParkingSpacesFromXpand')
    return { ok: false, err: 'unknown' } as const
  }
}

const deleteListing = async (
  listingId: number
): Promise<
  AdapterResult<
    null,
    {
      tag: 'conflict' | 'unknown'
      data: unknown
    }
  >
> => {
  const res = await axios.delete(
    `${tenantsLeasesServiceUrl}/listings/${listingId}`
  )

  if (res.status === 200) {
    return { ok: true, data: null }
  }

  if (res.status === 409) {
    return { ok: false, err: { tag: 'conflict', data: res.data } }
  }

  return { ok: false, err: { tag: 'unknown', data: res.data } }
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

export {
  getLease,
  getLeasesForPnr,
  getLeasesForPropertyId,
  getContactForPnr,
  getContact,
  getContactByPhoneNumber,
  createLease,
  getCreditInformation,
  getInternalCreditInformation,
  getWaitingList,
  addApplicantToWaitingList,
  resetWaitingList,
  createNewListing,
  getListingByListingId,
  getListingByRentalObjectCode,
  applyForListing,
  getListingsWithApplicants,
  getApplicantsByContactCode,
  getApplicantsAndListingByContactCode,
  getApplicantByContactCodeAndListingId,
  getListingByIdWithDetailedApplicants,
  withdrawApplicantByManager,
  withdrawApplicantByUser,
  setApplicantStatusActive,
  createOffer,
  updateApplicantStatus,
  getOffersForContact,
  getOfferByOfferId,
  getContactsDataBySearchQuery,
  getContactByContactCode,
  getOfferByContactCodeAndOfferId,
  validateResidentialAreaRentalRules,
  validatePropertyRentalRules,
  getTenantByContactCode,
  syncInternalParkingSpacesFromXpand,
  deleteListing,
  closeOfferByAccept,
  getOffersByListingId,
  closeOfferByDeny,
  handleExpiredOffers,
  getActiveOfferByListingId,
}
