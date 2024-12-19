import { Room } from '../types'
import { GET } from './baseApi'

export const roomService = {
  // Get all rooms for a residence
  async getByResidenceId(residenceId: string): Promise<Room[]> {
    const { data, error } = await GET('/residences', {
      params: { query: { buildingCode: residenceId } }
    })
    if (error) throw error
    return data?.content as Room[]
  },

  // Get room by ID
  async getById(residenceId: string, roomId: string): Promise<Room> {
    const { data, error } = await GET('/rooms/{id}', {
      params: { path: { id: roomId } }
    })
    if (error) throw error
    return data as Room
  },

  // Get rooms by type
  async getByType(residenceId: string, roomType: string): Promise<Room[]> {
    const { data, error } = await GET('/rooms', {
      params: { query: { buildingCode: residenceId, floorCode: roomType } }
    })
    if (error) throw error
    return data?.content as Room[]
  },
}
