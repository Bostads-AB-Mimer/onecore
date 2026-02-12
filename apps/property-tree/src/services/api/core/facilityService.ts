import { GET } from './baseApi'
import { components } from './generated/api-types'

type Facility = components['schemas']['FacilityDetails']
type FacilitySearchResult = components['schemas']['FacilitySearchResult']

export const facilityService = {
  async getByRentalId(rentalId: string): Promise<Facility> {
    const { data, error } = await GET('/facilities/by-rental-id/{rentalId}', {
      params: { path: { rentalId } },
    })

    if (error) throw error
    if (!data.content) throw new Error('No facility found')

    return data.content
  },

  async search(q: string): Promise<FacilitySearchResult[]> {
    const { data, error } = await GET('/facilities/search', {
      params: { query: { q } },
    })

    if (error) throw error

    return data?.content || []
  },
}
