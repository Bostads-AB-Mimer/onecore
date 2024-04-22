import axios, { AxiosError, HttpStatusCode } from 'axios'
import {
  ConsumerReport,
  Contact,
  Invoice,
  InvoiceTransactionType,
  Lease,
  WaitingList,
  Listing,
  Applicant,
} from 'onecore-types'
import config from '../common/config'
import dayjs from 'dayjs'

//todo: move to global config or handle error statuses in middleware
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status < 500 // override Axios throwing errors so that we can handle errors manually
}

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

const getLease = async (leaseId: string): Promise<Lease> => {
  const leaseResponse = await axios(
    tenantsLeasesServiceUrl + '/leases/' + leaseId
  )

  return leaseResponse.data.data
}

const getLeasesForPnr = async (
  nationalRegistrationNumber: string
): Promise<Lease[]> => {
  const leasesResponse = await axios(
    tenantsLeasesServiceUrl +
      '/leases/for/nationalRegistrationNumber/' +
      nationalRegistrationNumber
  )
  return leasesResponse.data.data
}

const getLeasesForPropertyId = async (propertyId: string): Promise<Lease[]> => {
  const leasesResponse = await axios(
    tenantsLeasesServiceUrl + '/leases/for/propertyId/' + propertyId
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

const getListingByRentalObjectCode = async (rentalObjectCode: string) => {
  try {
    return await axios.get(
      `${tenantsLeasesServiceUrl}/listings/${rentalObjectCode}`
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
  getListingByRentalObjectCode,
  applyForListing,
  getListingsWithApplicants,
  getApplicantsByContactCode,
  getApplicantByContactCodeAndRentalObjectCode,
}
