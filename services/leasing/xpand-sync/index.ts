import axios, { AxiosError, AxiosResponse } from 'axios'
import dotenv from 'dotenv'
dotenv.config()
import { Contact, LeaseStatus, Lease } from './types'
import qs from 'qs'

const xpandUrl = process.env.XPAND__URL

const tenantLeasesUrl = process.env.TENANTS_LEASES__URL
const tenantsLeasesHeaders = {
  'Content-Type': 'application/json',
}

let accessToken: string | undefined = undefined

const getAccessToken = async () => {
  const data = qs.stringify({
    grant_type: 'client_credentials',
    client_secret: process.env.XPAND__CLIENT_SECRET,
    client_id: process.env.XPAND__CLIENT_ID,
    scope: process.env.XPAND__SCOPE,
  })

  const config = {
    method: 'post',
    url: `https://login.microsoftonline.com/${process.env.XPAND__TENANT_ID}/oauth2/v2.0/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: data,
  }

  const result = await axios(config)

  return result.data.access_token
}

const createXpandHeaders = (accessToken: string) => {
  const xpandHeaders = {
    Authorization: 'Bearer ' + accessToken,
    'Ocp-Apim-Subscription-Key': process.env.XPAND__SUBSCRIPTION_KEY,
  }

  return xpandHeaders
}

const getFromXpand = async (url: string): Promise<AxiosResponse<any, any>> => {
  if (!accessToken) {
    accessToken = await getAccessToken()
  }

  try {
    return await axios.get(url, {
      headers: createXpandHeaders(accessToken ?? ''),
    })
  } catch (error) {
    const axiosErr = error as AxiosError

    if (axiosErr.response?.status === 401) {
      accessToken = await getAccessToken()
      return await getFromXpand(url)
    }

    throw error
  }
}

const syncContactToTenantsLeases = async (contact: any) => {
  const transformedContact: Contact = {
    contactId:
      contact.contactId === 'RENSAD_GDPR' // Temporary for mocked api
        ? 'P' + contact.contractId
        : contact.contactId,
    firstName: contact.firstname,
    lastName: contact.lastname,
    fullName: contact.fullname,
    type: contact.contractRelation,
    birthDate: contact.birthDate,
    mobilePhone: contact.phoneMobile,
    phoneNumber: contact.phoneHome,
    nationalRegistrationNumber: contact.socSecNo,
    leaseId: contact.contractId,
    lease: undefined,
    address: undefined,
    emailAddress: contact.email,
    lastUpdated: undefined,
  }

  const result = await axios.post(
    `${tenantLeasesUrl}/contacts`,
    transformedContact,
    {
      headers: tenantsLeasesHeaders,
    }
  )
}

const syncContactsToTenantsLeases = async (contacts: any) => {
  const transformedContacts = contacts.map((contact: any) => {
    const transformedContact: Contact = {
      contactId: contact.contactId,
      firstName: contact.firstname,
      lastName: contact.lastname,
      fullName: contact.fullname,
      type: contact.contractRelation,
      birthDate: contact.birthDate,
      mobilePhone: contact.phoneMobile,
      phoneNumber: contact.phoneHome,
      nationalRegistrationNumber: contact.socSecNo,
      leaseId: contact.contractId,
      lease: undefined,
      address: undefined,
      emailAddress: contact.email,
      lastUpdated: undefined,
    }

    return transformedContact
  })

  await axios.post(`${tenantLeasesUrl}/contacts`, transformedContacts, {
    headers: tenantsLeasesHeaders,
  })
}

const syncContractsToTenantsLeases = async (contracts: any) => {
  const transformedContracts = contracts.map((contract: any) => {
    const transformedContract: Lease = {
      leaseId: contract.contractId,
      leaseNumber: '',
      leaseStartDate: contract.fromDate,
      leaseEndDate: contract.toDate,
      status: LeaseStatus.Active,
      tenantContactIds: undefined,
      tenants: undefined,
      type: contract.contractType,
      rentalPropertyId: contract.rentalPropertyId,
      rentalProperty: undefined,
      lastUpdated: undefined,
      rentInfo: undefined,
    }

    return transformedContract
  })

  await axios.post(`${tenantLeasesUrl}/leases`, transformedContracts, {
    headers: tenantsLeasesHeaders,
  })
}

const syncContractToTenantsLeases = async (contract: any) => {
  const transformedContract: Lease = {
    leaseId: contract.contractId,
    leaseNumber: '',
    leaseStartDate: contract.fromDate,
    leaseEndDate: contract.toDate,
    status: LeaseStatus.Active,
    tenantContactIds: undefined,
    tenants: undefined,
    type: contract.contractType,
    rentalPropertyId: contract.rentalPropertyId,
    rentalProperty: undefined,
    lastUpdated: undefined,
    rentInfo: undefined,
  }

  const result = await axios.post(
    `${tenantLeasesUrl}/leases`,
    transformedContract,
    {
      headers: tenantsLeasesHeaders,
    }
  )

  return result
}

const syncContacts = async () => {
  const pageSize = 1000
  let currentPage = 1
  let hasNext = true

  while (hasNext) {
    const xpandContacts = await getFromXpand(
      `${xpandUrl}/Contact?page_number=${currentPage++}&page_size=${pageSize}`
    )

    console.log(
      xpandContacts.data.currentPage,
      'of',
      xpandContacts.data.totalPages
    )

    await syncContactsToTenantsLeases(xpandContacts.data.items)

    hasNext = xpandContacts.data.hasNext
  }
}

const syncContracts = async () => {
  const pageSize = 1000
  let currentPage = 1
  let hasNext = true

  while (hasNext) {
    const xpandContracts = await getFromXpand(
      `${xpandUrl}/Contract?page_number=${currentPage++}&page_size=${pageSize}&activeContracts=true`
    )

    console.log(
      xpandContracts.data.currentPage,
      'of',
      xpandContracts.data.totalPages
    )

    await syncContractsToTenantsLeases(xpandContracts.data.items)

    hasNext = xpandContracts.data.hasNext
  }
}

const runSync = async () => {
  //await syncContacts()
  await syncContracts()
}

runSync()
