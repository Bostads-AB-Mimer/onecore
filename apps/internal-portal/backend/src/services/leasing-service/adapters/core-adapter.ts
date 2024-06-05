import Config from '../../../common/config'
import { getFromCore } from '../../common/adapters/core-adapter'
import {DetailedApplicant, Listing} from "onecore-types";

const coreBaseUrl = Config.core.url

const getListingsWithApplicants = async () => {
  const url = `${coreBaseUrl}/listings-with-applicants`
  const listingsResponse = await getFromCore({
    method: 'get',
    url: url,
  })

  return listingsResponse.data
}

const getListingWithApplicants = async (listingId: string): Promise<Listing & { applicants: DetailedApplicant[] }> => {
  const listing: Promise<Listing> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listing/${listingId}`,
  }).then((res) => res.data)

  const applicants: Promise<DetailedApplicant[]> = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listing/${listingId}/applicants/details`,
  }).then((res) => res.data)

  const [listingResult, applicantsResult] = await Promise.all([listing, applicants])

  return {
    ...listingResult,
    applicants: applicantsResult || [],
  }
}

const removeApplicant = async (applicantId: string) => {
  const response = await getFromCore({
    method: 'delete',
    url: `${coreBaseUrl}/applicants/${applicantId}/by-manager`,
  })

  return response.data
}

export { getListingsWithApplicants, getListingWithApplicants, removeApplicant }
