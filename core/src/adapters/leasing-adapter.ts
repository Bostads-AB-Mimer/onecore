import { loggedAxios as axios, logger } from 'onecore-utilities'

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
} from 'onecore-types'
import config from '../common/config'
import dayjs from 'dayjs'
import { AdapterResult } from './types'
import { AxiosResponse, HttpStatusCode } from 'axios'

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

  return leaseResponse.data.data
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
  return leasesResponse.data.data
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
  return leasesResponse.data.data
}

const getContactForPnr = async (
  nationalRegistrationNumber: string
): Promise<Contact> => {
  const contactResponse = await axios(
    tenantsLeasesServiceUrl +
      '/contact/nationalRegistrationNumber/' +
      nationalRegistrationNumber
  )

  return contactResponse.data.data
}

const getContactsDataBySearchQuery = async (
  q: string
): Promise<
  AdapterResult<Array<Pick<Contact, 'fullName' | 'contactCode'>>, unknown>
> => {
  try {
    const response = await axios.get<{ data: Array<Contact> }>(
      `${tenantsLeasesServiceUrl}/contacts/search?q=${q}`
    )

    if (response.status === 200) {
      return { ok: true, data: response.data.data }
    }

    throw response.data
  } catch (err) {
    logger.error({ err }, 'leasingAdapter.getContactsBySearchQuery')
    return { ok: false, err }
  }
}

const getContact = async (contactId: string): Promise<Contact | undefined> => {
  try {
    const contactResponse = await axios(
      tenantsLeasesServiceUrl + '/contact/contactCode/' + contactId
    )

    return contactResponse.data.data
  } catch (error) {
    return undefined
  }
}

const getContactByContactCode = async (
  contactCode: string
): Promise<AdapterResult<Contact, 'not-found' | 'unknown'>> => {
  try {
    const res = await axios.get<{ data: Contact }>(
      `${tenantsLeasesServiceUrl}/contact/contactCode/${contactCode}`
    )

    if (!res.data.data) return { ok: false, err: 'not-found' }

    return { ok: true, data: res.data.data }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getContactByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

const getContactForPhoneNumber = async (
  phoneNumber: string
): Promise<Contact | undefined> => {
  try {
    const contactResponse = await axios(
      tenantsLeasesServiceUrl + '/contact/phoneNumber/' + phoneNumber
    )
    return contactResponse.data.data
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

  return result.data
}

const getCreditInformation = async (
  nationalRegistrationNumber: string
): Promise<ConsumerReport> => {
  const informationResponse = await axios(
    tenantsLeasesServiceUrl +
      '/cas/getConsumerReport/' +
      nationalRegistrationNumber
  )
  return informationResponse.data.data
}

const getInternalCreditInformation = async (
  contactCode: string
): Promise<boolean> => {
  const result = await axios(
    tenantsLeasesServiceUrl + '/contact/invoices/contactCode/' + contactCode
  )

  const invoices = result.data.data as Invoice[] | undefined
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
  const waitingList = await axios(
    tenantsLeasesServiceUrl +
      '/contact/waitingList/' +
      nationalRegistrationNumber
  )
  return waitingList.data.data
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
  return axios(
    tenantsLeasesServiceUrl +
      '/contact/waitingList/' +
      nationalRegistrationNumber,
    axiosOptions
  )
}

const createNewListing = async (listingData: Listing) => {
  try {
    return await axios.post(`${tenantsLeasesServiceUrl}/listings`, listingData)
  } catch (error) {
    logger.error(error, 'Error creating new listing:')
    return undefined
  }
}

const applyForListing = async (applicantData: Omit<Applicant, 'id'>) => {
  try {
    return await axios.post(
      `${tenantsLeasesServiceUrl}/listings/apply`,
      applicantData
    )
  } catch (error) {
    logger.error(error, 'Error applying for listing:', error)
    return undefined
  }
}

const getListingByListingId = async (
  listingId: string
): Promise<Listing | undefined> => {
  try {
    const result = await axios.get(
      `${tenantsLeasesServiceUrl}/listings/by-id/${listingId}`
    )
    return result.data
  } catch (error) {
    logger.error(error, 'Error fetching listing by rental object code')
    return undefined
  }
}

const getListingByRentalObjectCode = async (rentalObjectCode: string) => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/listings/by-code/${rentalObjectCode}`
    )

    return response
  } catch (error) {
    logger.error(error, 'Error fetching listing by rental object code:', error)
    return undefined
  }
}

const getListingsWithApplicants = async (): Promise<any[] | undefined> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/listings-with-applicants`
    )
    return response.data
  } catch (error) {
    logger.error(error, 'Error fetching listings with applicants:')
    return undefined
  }
}

const getApplicantsByContactCode = async (
  contactCode: string
): Promise<any[] | undefined> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/applicants/${contactCode}/`
    )
    return response.data
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
      const listingResponse = await getListingByListingId(
        applicant.listingId.toString()
      )
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
      `${tenantsLeasesServiceUrl}/applicants/${contactCode}/${listingId}}`
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
    return response.data
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

type CreateOfferParams = Omit<
  Offer,
  'id' | 'sentAt' | 'answeredAt' | 'offeredApplicant' | 'createdAt'
> & { applicantId: number }

const createOffer = async (params: CreateOfferParams): Promise<Offer> => {
  try {
    const response = await axios.post<{ data: Offer }>(
      `${tenantsLeasesServiceUrl}/offer`,
      params
    )

    return response.data.data
  } catch (err) {
    logger.error(err, 'Error creating offer:')
    throw err
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

    return { ok: true, data: res.data.data }
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
    return { ok: true, data: res.data.data }
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.getOffersForContact')
    return { ok: false, err: 'unknown' }
  }
}

const validateRentalRules = (
  validationResult: AxiosResponse,
  applicationType: string
): AdapterResult<
  { reason: string },
  | 'not-found'
  | 'unknown'
  | 'contact-not-found'
  | 'not-a-parking-space'
  | 'no-contract-in-the-area'
  | 'not-allowed-to-rent-additional'
  | 'unexpected-error'
> => {
  if (validationResult.status == HttpStatusCode.NotFound) {
    return { ok: false, err: 'not-found' }
  } else if (validationResult.status == HttpStatusCode.InternalServerError) {
    return {
      ok: false,
      err: 'contact-not-found',
    }
  } else if (validationResult.status == HttpStatusCode.BadRequest) {
    return {
      ok: false,
      err: 'not-a-parking-space',
    }
  } else if (validationResult.status == HttpStatusCode.Forbidden) {
    return {
      ok: false,
      err: 'no-contract-in-the-area',
    }
  } else if (validationResult.status == HttpStatusCode.Ok) {
    if (validationResult.data.applicationType == 'Additional') {
      //Applicant is allowed to rent an additional parking space in this area
      return { ok: true, data: { reason: validationResult.data.reason } }
    } else if (
      validationResult.data.applicationType == 'Replace' &&
      applicationType == 'Replace'
    ) {
      //Applicant is allowed to replace their current parking space for a new one in this area
      return { ok: true, data: { reason: validationResult.data.reason } }
    } else {
      //Applicant is not allowed to rent an additional parking space in this area
      return {
        ok: false,
        err: 'not-allowed-to-rent-additional',
      }
    }
  }

  return { ok: false, err: 'unexpected-error' }
}

const validateResidentialAreaRentalRules = async (
  contactCode: string,
  districtCode: string,
  applicationType: string
): Promise<
  AdapterResult<
    { reason: string },
    | 'not-found'
    | 'unknown'
    | 'contact-not-found'
    | 'not-a-parking-space'
    | 'no-contract-in-the-area'
    | 'not-allowed-to-rent-additional'
    | 'unexpected-error'
  >
> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/applicants/validateResidentialAreaRentalRules/${contactCode}/${districtCode}`
    )
    return validateRentalRules(res, applicationType)
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.validateResidentialAreaRentalRules')
    return { ok: false, err: 'unknown' }
  }
}

const validatePropertyRentalRules = async (
  contactCode: string,
  rentalObjectCode: string,
  applicationType: string
): Promise<
  AdapterResult<
    { reason: string },
    | 'not-found'
    | 'unknown'
    | 'contact-not-found'
    | 'not-a-parking-space'
    | 'no-contract-in-the-area'
    | 'not-allowed-to-rent-additional'
    | 'unexpected-error'
  >
> => {
  try {
    const res = await axios(
      `${tenantsLeasesServiceUrl}/applicants/validatePropertyRentalRules/${contactCode}/${rentalObjectCode}`
    )
    return validateRentalRules(res, applicationType)
  } catch (err) {
    logger.error({ err }, 'leasing-adapter.validatePropertyRentalRules')
    return { ok: false, err: 'unknown' }
  }
}

export {
  getLease,
  getLeasesForPnr,
  getLeasesForPropertyId,
  getContactForPnr,
  getContact,
  getContactForPhoneNumber,
  createLease,
  getCreditInformation,
  getInternalCreditInformation,
  getWaitingList,
  addApplicantToWaitingList,
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
  getContactsDataBySearchQuery,
  getContactByContactCode,
  getOfferByContactCodeAndOfferId,
  validateResidentialAreaRentalRules,
  validatePropertyRentalRules,
}
