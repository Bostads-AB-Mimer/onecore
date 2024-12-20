import { Room } from '../types'
import { GET } from './baseApi'

export const roomService = {
  // Get rooms by building, floor and residence codes
  async getByBuildingAndFloorAndResidence(
    buildingCode: string,
    floorCode: string,
    residenceCode: string
  ): Promise<Room[]> {
    const { data, error } = await GET('/rooms', {
      params: {
        query: {
          buildingCode,
          floorCode,
          residenceCode,
        },
      },
    })
    if (error) throw error
    return data?.content || []
  },

  // Get room by ID
  async getById(id: string): Promise<Room> {
    const { data, error } = await GET('/rooms/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data
  },
}
