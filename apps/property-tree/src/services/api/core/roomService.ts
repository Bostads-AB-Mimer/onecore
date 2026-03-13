import { GET } from './baseApi'
import type { components } from './generated/api-types'

type Room = components['schemas']['Room']

export const roomService = {
  async getByResidenceId(
    residenceId: string,
    roomCode?: string
  ): Promise<Room[]> {
    const { data, error } = await GET('/rooms', {
      params: {
        query: {
          residenceId,
          roomCode,
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
