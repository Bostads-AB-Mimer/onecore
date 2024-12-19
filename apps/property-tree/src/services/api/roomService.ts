import { Room } from '../types'
import { fetchApi } from './baseApi'

export const roomService = {
  // Get all rooms for a residence
  async getByResidenceId(residenceId: string): Promise<Room[]> {
    const { data, error } = await GET(`/residences/${residenceId}/rooms`)
    if (error) throw error
    return data?.content as Room[]
  },

  // Get room by ID
  async getById(residenceId: string, roomId: string): Promise<Room> {
    const { data, error } = await GET(`/residences/${residenceId}/rooms/${roomId}`)
    if (error) throw error
    return data as Room
  },

  // Get rooms by type
  async getByType(residenceId: string, roomType: string): Promise<Room[]> {
    const { data, error } = await GET(`/residences/${residenceId}/rooms?type=${roomType}`)
    if (error) throw error
    return data?.content as Room[]
  }
}
