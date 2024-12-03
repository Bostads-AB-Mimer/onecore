import { Room } from '../types'
import { fetchApi } from './baseApi'

export const roomService = {
  // Get all rooms for a residence
  async getByResidenceId(residenceId: string): Promise<Room[]> {
    const response = await fetchApi<{content: Room[]}>(`/residences/${residenceId}/rooms/`)
    return response.content
  },

  // Get room by ID
  async getById(residenceId: string, roomId: string): Promise<Room> {
    return fetchApi<Room>(`/residences/${residenceId}/rooms/${roomId}/`)
  },

  // Get rooms by type
  async getByType(residenceId: string, roomType: string): Promise<Room[]> {
    const response = await fetchApi<{content: Room[]}>(`/residences/${residenceId}/rooms/?roomType=${roomType}`)
    return response.content
  }
}
