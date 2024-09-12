import {
  Contact,
  DetailedApplicant,
  InternalParkingSpaceSyncSuccessResponse,
  Listing,
  Tenant,
} from 'onecore-types'
import { AxiosError } from 'axios'

import Config from '../../../common/config'
import { getFromCore } from '../../common/adapters/core-adapter'

const coreBaseUrl = Config.core.url

type AdapterResult<T, E> = { ok: false; err: E } | { ok: true; data: T }

const getListingsWithApplicants = async (): Promise<
  AdapterResult<Array<unknown>, 'unknown'>
> => {
  try {
    const url = `${coreBaseUrl}/listings-with-applicants`
    const listingsResponse = await getFromCore({
      method: 'get',
      url: url,
    })

    return { ok: true, data: listingsResponse.data.content }
  } catch (err) {
    return { ok: false, err: 'unknown' }
  }
}

const getListingWithApplicants = async (
  listingId: string
): Promise<Listing & { applicants: DetailedApplicant[] }> => {
  const listing: Promise<Listing> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listing/${listingId}`,
  }).then((res) => res.data.content)

  const applicants: Promise<DetailedApplicant[]> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listing/${listingId}/applicants/details`,
  }).then((res) => res.data.content)

  const [listingResult, applicantsResult] = await Promise.all([
    listing,
    applicants,
  ])

  return { ...listingResult, applicants: applicantsResult || [] }
}

const removeApplicant = async (applicantId: string) => {
  const response = await getFromCore({
    method: 'delete',
    url: `${coreBaseUrl}/applicants/${applicantId}/by-manager`,
  })

  return response.data
}

const getContactsDataBySearchQuery = async (
  q: string
): Promise<
  AdapterResult<Array<Pick<Contact, 'fullName' | 'contactCode'>>, unknown>
> => {
  try {
    const result = await getFromCore<{ content: Array<Contact> }>({
      method: 'get',
      url: `${coreBaseUrl}/contacts/search?q=${q}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    return { ok: false, err }
  }
}

const getTenantByContactCode = async (
  contactCode: string
): Promise<AdapterResult<Tenant, unknown>> => {
  try {
    const result = await getFromCore<{ content: Tenant }>({
      method: 'get',
      url: `${coreBaseUrl}/tenants/contactCode/${contactCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.content }
  } catch (err) {
    return { ok: false, err }
  }
}

const validatePropertyRentalRules = async (
  contactCode: string,
  rentalObjectCode: string
): Promise<
  AdapterResult<
    { applicationType: 'Replace' | 'Additional' },
    'no-contract-in-area-or-property' | 'unknown'
  >
> => {
  try {
    const result = await getFromCore<{
      data: { applicationType: 'Replace' | 'Additional' }
    }>({
      method: 'get',
      url: `${coreBaseUrl}/applicants/validate-rental-rules/property/${contactCode}/${rentalObjectCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.data }
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 403) {
      return { ok: false, err: 'no-contract-in-area-or-property' }
    } else {
      return { ok: false, err: 'unknown' }
    }
  }
}

const validateResidentialAreaRentalRules = async (
  contactCode: string,
  districtCode: string
): Promise<
  AdapterResult<
    { applicationType: 'Replace' | 'Additional' },
    'no-contract-in-area-or-property' | 'unknown'
  >
> => {
  try {
    const result = await getFromCore<{
      data: { applicationType: 'Replace' | 'Additional' }
    }>({
      method: 'get',
      url: `${coreBaseUrl}/applicants/validate-rental-rules/residential-area/${contactCode}/${districtCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.data }
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 403) {
      return { ok: false, err: 'no-contract-in-area-or-property' }
    } else {
      return { ok: false, err: 'unknown' }
    }
  }
}

const createNoteOfInterestForInternalParkingSpace = async (params: {
  parkingSpaceId: string
  applicationType: string
  contactCode: string
}): Promise<AdapterResult<unknown, unknown>> => {
  try {
    // todo: fix type
    const response = await getFromCore<any>({
      method: 'post',
      url: `${coreBaseUrl}/parkingspaces/${params.parkingSpaceId}/noteofinterests`,
      data: params,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    return { ok: false, err }
  }
}

const createOffer = async (params: {
  listingId: string
}): Promise<AdapterResult<unknown, unknown>> => {
  try {
    const response = await getFromCore<any>({
      method: 'post',
      url: `${coreBaseUrl}/listings/${params.listingId}/offers`,
      data: params,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    return { ok: false, err }
  }
}

const syncInternalParkingSpacesFromXpand = async (): Promise<
  AdapterResult<InternalParkingSpaceSyncSuccessResponse, 'unknown'>
> => {
  try {
    const response = await getFromCore<{
      content: InternalParkingSpaceSyncSuccessResponse
    }>({
      method: 'post',
      url: `${coreBaseUrl}/listings/sync-internal-from-xpand`,
    })

    return { ok: true, data: response.data.content }
  } catch (err) {
    return { ok: false, err: 'unknown' }
  }
}

const deleteListing = async (
  listingId: number
): Promise<AdapterResult<null, 'conflict' | 'unknown'>> => {
  try {
    await getFromCore<{
      content: InternalParkingSpaceSyncSuccessResponse
    }>({
      method: 'delete',
      url: `${coreBaseUrl}/listings/${listingId}`,
    })

    return { ok: true, data: null }
  } catch (err) {
    if (err instanceof AxiosError) {
      if (err.status === 409) {
        return { ok: false, err: 'conflict' }
      }
    }

    return { ok: false, err: 'unknown' }
  }
}

export {
  getListingsWithApplicants,
  getListingWithApplicants,
  removeApplicant,
  getContactsDataBySearchQuery,
  getTenantByContactCode,
  createNoteOfInterestForInternalParkingSpace,
  validatePropertyRentalRules,
  validateResidentialAreaRentalRules,
  syncInternalParkingSpacesFromXpand,
  createOffer,
  deleteListing,
}
