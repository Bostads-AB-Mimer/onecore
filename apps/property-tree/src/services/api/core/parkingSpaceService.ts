import { GET } from './baseApi'
import { components } from './generated/api-types'

type ParkingSpace = components['schemas']['ParkingSpace']

export const parkingSpaceService = {
  async getByRentalId(rentalId: string): Promise<ParkingSpace> {
    const { data, error } = await GET(
      '/parking-spaces/by-rental-id/{rentalId}',
      {
        params: { path: { rentalId } },
      }
    )

    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')

    return data.content
  },
}
