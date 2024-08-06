import { Applicant, Contact, DetailedApplicant, Listing } from 'onecore-types'

import Config from '../../../common/config'
import { getFromCore } from '../../common/adapters/core-adapter'

const coreBaseUrl = Config.core.url

type AdapterResult<T, E> = { ok: false; err: E } | { ok: true; data: T }

const getListingsWithApplicants = async () => {
  const url = `${coreBaseUrl}/listings-with-applicants`
  const listingsResponse = await getFromCore({
    method: 'get',
    url: url,
  })

  return listingsResponse.data.content
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
    const result = await getFromCore<{ data: { content: Array<Contact> } }>({
      method: 'get',
      url: `${coreBaseUrl}/contacts/search?q=${q}`,
    }).then((res) => res.data)

    return { ok: true, data: result.data.content }
  } catch (err) {
    return { ok: false, err }
  }
}

const getContactByContactCode = async (
  contactCode: string
): Promise<AdapterResult<Contact, unknown>> => {
  try {
    const result = await getFromCore<{ data: { content: Contact } }>({
      method: 'get',
      url: `${coreBaseUrl}/contact/contactCode/${contactCode}`,
    }).then((res) => res.data)

    return { ok: true, data: result.data.content }
  } catch (err) {
    return { ok: false, err }
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

export {
  getListingsWithApplicants,
  getListingWithApplicants,
  removeApplicant,
  getContactsDataBySearchQuery,
  getContactByContactCode,
  createNoteOfInterestForInternalParkingSpace,
}
