import { Room } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockRooms } from '../mockData'

export const roomService = {
  // Get all rooms for a residence
  async getByResidenceId(residenceId: string): Promise<Room[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return mockRooms[residenceId] || []
  },

  // Get room by ID
  async getById(residenceId: string, roomId: string): Promise<Room> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const room = mockRooms[residenceId]?.find((r) => r.id === roomId)
    if (!room) {
      throw new Error(`Room with id ${roomId} not found`)
    }
    return room
  },

  // Create new room
  async create(residenceId: string, data: Omit<Room, 'id'>): Promise<Room> {
    // TODO: Replace with actual API call
    return fetchApi<Room>(`/residences/${residenceId}/rooms`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update room
  async update(
    residenceId: string,
    roomId: string,
    data: Partial<Room>,
  ): Promise<Room> {
    // TODO: Replace with actual API call
    return fetchApi<Room>(`/residences/${residenceId}/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete room
  async delete(residenceId: string, roomId: string): Promise<void> {
    // TODO: Replace with actual API call
    return fetchApi<void>(`/residences/${residenceId}/rooms/${roomId}`, {
      method: 'DELETE',
    })
  },
}
