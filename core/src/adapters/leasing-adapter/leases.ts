import { loggedAxios as axios, logger } from '@onecore/utilities'

import { AdapterResult } from '../types'
import config from '../../common/config'
import { Lease } from '@onecore/types'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

interface GetLeasesOptions {
  includeUpcomingLeases: boolean
  includeTerminatedLeases: boolean
  includeContacts: boolean
}

export const getLease = async (
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

export const getLeasesForPnr = async (
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

export const getLeasesForContactCode = async (
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

export const getLeasesForPropertyId = async (
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

export const createLease = async (
  objectId: string,
  contactId: string,
  fromDate: string,
  companyCode: string,
  includeVAT: boolean
): Promise<AdapterResult<string, 'create-lease-failed' | 'unknown'>> => {
  const axiosOptions = {
    method: 'POST',
    data: {
      parkingSpaceId: objectId,
      contactCode: contactId,
      fromDate,
      companyCode,
      includeVAT,
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
