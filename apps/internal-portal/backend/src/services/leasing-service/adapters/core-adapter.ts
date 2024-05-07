import Config from '../../../common/config'
import { getFromCore } from '../../common/adapters/core-adapter'

const coreBaseUrl = Config.core.url

const getListingsWithApplicants = async () => {
  const url = `${coreBaseUrl}/listings-with-applicants`
  const listingsResponse = await getFromCore({
    method: 'get',
    url: url,
  })

  return listingsResponse.data
}

const getListingWithApplicants = async (listingId: string) => {
  const listing = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listing/${listingId}`,
  }).then((res) => res.data)

  const applicants = getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/listing/${listingId}/applicants/details`,
  }).then((res) => res.data)

  return await Promise.all([listing, applicants]).then(
    ([listing, applicants]: any) => ({
      ...listing,
      applicants: applicants || [],
    })
  )
}

const removeApplicant = async (applicantId: string) => {
  const response = await getFromCore({
    method: 'delete',
    url: `${coreBaseUrl}/applicants/${applicantId}/by-manager`,
  })

  return response.data
}

export { getListingsWithApplicants, getListingWithApplicants, removeApplicant }
