import { GET } from './base-api'
import type { components } from './generated/api-types'

type Room = components['schemas']['Room']

export const roomService = {
  async getByResidenceId(residenceId: string): Promise<Room[]> {
    const { data, error } = await GET('/rooms', {
      params: {
        query: {
          residenceId,
        },
      },
    })
    if (error) throw error
    return data?.content || []
  },

  async getByFacilityId(facilityId: string): Promise<Room[]> {
    const { data, error } = await GET('/rooms/by-facility-id/{facilityId}', {
      params: {
        path: {
          facilityId,
        },
      },
    })
    if (error) throw error
    return data?.content || []
  },
}
