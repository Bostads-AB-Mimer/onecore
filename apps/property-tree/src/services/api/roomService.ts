import { Room } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockRooms } from '../mockData'

export const roomService = {
  // Get all rooms for an apartment
  async getByApartmentId(apartmentId: string): Promise<Room[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return mockRooms[apartmentId] || []
  },

  // Get room by ID
  async getById(apartmentId: string, roomId: string): Promise<Room> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const room = mockRooms[apartmentId]?.find((r) => r.id === roomId)
    if (!room) {
      throw new Error(`Room with id ${roomId} not found`)
    }
    return room
  },

  // Create new room
  async create(apartmentId: string, data: Omit<Room, 'id'>): Promise<Room> {
    // TODO: Replace with actual API call
    return fetchApi<Room>(`/apartments/${apartmentId}/rooms`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update room
  async update(
    apartmentId: string,
    roomId: string,
    data: Partial<Room>,
  ): Promise<Room> {
    // TODO: Replace with actual API call
    return fetchApi<Room>(`/apartments/${apartmentId}/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete room
  async delete(apartmentId: string, roomId: string): Promise<void> {
    // TODO: Replace with actual API call
    return fetchApi<void>(`/apartments/${apartmentId}/rooms/${roomId}`, {
      method: 'DELETE',
    })
  },
}
