import axios from 'axios'
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
} from 'onecore-types'
import config from '../common/config'
import dayjs from 'dayjs'

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
    tenantsLeasesServiceUrl + '/contact/' + nationalRegistrationNumber
  )

  return contactResponse.data.data
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
    console.error('Error creating new listing:', error)
    return undefined
  }
}

const applyForListing = async (applicantData: Applicant) => {
  try {
    return await axios.post(
      `${tenantsLeasesServiceUrl}/listings/apply`,
      applicantData
    )
  } catch (error) {
    console.error('Error applying for listing:', error)
    return undefined
  }
}

const getListingByListingId = async (listingId: string) => {
  try {
    const result = await axios.get(
      `${tenantsLeasesServiceUrl}/listings/by-id/${listingId}`
    )
    return result.data
  } catch (error) {
    console.error('Error fetching listing by rental object code:', error)
    return undefined
  }
}

const getListingByRentalObjectCode = async (rentalObjectCode: string) => {
  try {
    return await axios.get(
      `${tenantsLeasesServiceUrl}/listings/by-code/${rentalObjectCode}`
    )
  } catch (error) {
    console.error('Error fetching listing by rental object code:', error)
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
    console.error('Error fetching listings with applicants:', error)
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
    console.error('Error fetching applicants by contact code:', error)
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
    console.error(
      'Error fetching applicants and listings by contact code:',
      error
    )
    return undefined
  }
}

const getApplicantByContactCodeAndRentalObjectCode = async (
  contactCode: string,
  rentalObjectCode: string
): Promise<any | undefined> => {
  try {
    const response = await axios.get(
      `${tenantsLeasesServiceUrl}/applicants/${contactCode}/${rentalObjectCode}`
    )
    return response.data
  } catch (error) {
    console.error(
      'Error fetching applicant by contact code and rental object code:',
      error
    )
    return undefined
  }
}

const getListingByIdWithDetailedApplicants = async (
  listingId: string
): Promise<any | undefined> => {
  try {
    const response = await axios(
      `${tenantsLeasesServiceUrl}/listing/${listingId}/applicants/details`
    )
    return response.data
  } catch (error) {
    console.error('Error fetching listing with detailed applicant data:', error)
    return undefined
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
    console.error('Error patching applicant status:', error)
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
    console.error('Error withdrawing applicant by user:', error)
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
    console.error('Error creating offer:', err)
    throw err
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
  getApplicantByContactCodeAndRentalObjectCode,
  getListingByIdWithDetailedApplicants,
  withdrawApplicantByManager,
  withdrawApplicantByUser,
  createOffer,
}
