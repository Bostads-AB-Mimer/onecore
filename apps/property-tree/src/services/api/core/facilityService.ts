import { GET } from './base-api'
import { components } from './generated/api-types'

type Facility = components['schemas']['FacilityDetails']

export const facilityService = {
  async getByRentalId(rentalId: string): Promise<Facility> {
    const { data, error } = await GET('/facilities/by-rental-id/{rentalId}', {
      params: { path: { rentalId } },
    })

    if (error) throw error
    if (!data.content) throw new Error('No facility found')

    return data.content
  },
}
