import {
  loggedAxios as axios,
  logger,
  PaginatedResponse,
} from '@onecore/utilities'
import { Lease, leasing } from '@onecore/types'
import z from 'zod'

import { AdapterResult } from '../types'
import config from '../../common/config'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

type GetLeaseOptions = z.infer<typeof leasing.v1.GetLeaseOptionsSchema>
type GetLeasesOptions = z.infer<typeof leasing.v1.GetLeasesOptionsSchema>
type HomeInsuranceStatus = {
  monthlyAmount: number
  from?: string
  to?: string
}

export const getLease = async (
  leaseId: string,
  options: GetLeaseOptions
): Promise<Lease> => {
  const queryParams = new URLSearchParams({
    includeContacts: options.includeContacts.toString(),
  })

  const leaseResponse = await axios(
    `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(leaseId)}?${queryParams.toString()}`
  )

  return leaseResponse.data.content
}

export const getLeasesByContactCode = async (
  contactCode: string,
  options: GetLeasesOptions
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams({
    includeContacts: options.includeContacts.toString(),
  })

  if (options.status) {
    queryParams.set('status', options.status.join(','))
  }

  const leasesResponse = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/by-contact-code/${contactCode}?${queryParams.toString()}`
  )

  return leasesResponse.data.content
}

export const getLeasesByRentalObjectCode = async (
  rentalObjectCode: string,
  options: GetLeasesOptions
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams({
    includeContacts: options.includeContacts.toString(),
    includeRentInfo: options.includeRentInfo.toString(),
  })

  if (options.status) {
    queryParams.set('status', options.status.join(','))
  }

  const leasesResponse = await axios(
    `${tenantsLeasesServiceUrl}/leases/by-rental-object-code/${rentalObjectCode}?${queryParams.toString()}`
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

type AddLeaseHomeInsuranceParams = z.infer<
  typeof leasing.v1.AddLeaseHomeInsuranceRequestSchema
>

export async function addLeaseHomeInsurance(
  leaseId: string,
  params: AddLeaseHomeInsuranceParams
): Promise<AdapterResult<null, 'unknown'>> {
  const result = await axios.post(
    `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(leaseId)}/rent-rows/home-insurance`,
    params
  )

  if (result.status === 201) {
    return { ok: true, data: result.data.content }
  } else {
    logger.error(
      { error: JSON.stringify(result.data) },
      'Unknown error when adding home insurance rent row'
    )

    return { ok: false, err: 'unknown' }
  }
}

export async function getLeaseHomeInsurance(
  leaseId: string
): Promise<AdapterResult<HomeInsuranceStatus, 'not-found' | 'unknown'>> {
  const result = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(leaseId)}/home-insurance`
  )

  if (result.status === 200) {
    return { ok: true, data: result.data.content }
  }

  if (result.status === 404) {
    return { ok: false, err: 'not-found' }
  }

  logger.error(
    { error: JSON.stringify(result.data) },
    'Unknown error when fetching home insurance'
  )

  return { ok: false, err: 'unknown' }
}

export async function deleteLeaseRentRow(params: {
  leaseId: string
  rentRowId: string
}): Promise<AdapterResult<null, 'unknown'>> {
  const result = await axios.delete(
    `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(params.leaseId)}/rent-rows/${params.rentRowId}`
  )

  if (result.status === 200) {
    return { ok: true, data: null }
  } else {
    logger.error(
      { error: JSON.stringify(result.data) },
      'Unknown error when deleting rent row'
    )

    return { ok: false, err: 'unknown' }
  }
}

// TODO: Move move to new microservice governingn organization. for now here just to make it available for the filter in /leases
export const getBuildingManagers = async (): Promise<
  { code: string; name: string; district: string }[]
> => {
  const response = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/building-managers`
  )
  return response.data.content
}

export const searchLeases = async (
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
