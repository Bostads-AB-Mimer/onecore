import { Room } from '../types'
import { fetchApi } from './baseApi'

export const roomService = {
  // Get rooms by building, floor and residence codes
  async getRooms(buildingCode: string, floorCode: string, residenceCode: string): Promise<Room[]> {
    const url = new URL('/rooms', API_BASE_URL)
    url.searchParams.append('buildingCode', buildingCode)
    url.searchParams.append('floorCode', floorCode)
    url.searchParams.append('residenceCode', residenceCode)
    const response = await fetchApi<{content: Room[]}>(url.toString())
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
