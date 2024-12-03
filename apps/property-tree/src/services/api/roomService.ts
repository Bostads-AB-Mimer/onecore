import { Room } from '../types'
import { fetchApi } from './baseApi'

export const roomService = {
  async getByResidenceId(residenceId: string): Promise<Room[]> {
    return fetchApi<Room[]>(`/residences/${residenceId}/rooms`)
  },

  async getById(residenceId: string, roomId: string): Promise<Room> {
    return fetchApi<Room>(`/residences/${residenceId}/rooms/${roomId}`)
  },

  async create(residenceId: string, data: Omit<Room, 'id'>): Promise<Room> {
    return fetchApi<Room>(`/residences/${residenceId}/rooms`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(
    residenceId: string,
    roomId: string,
    data: Partial<Room>,
  ): Promise<Room> {
    return fetchApi<Room>(`/residences/${residenceId}/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async delete(residenceId: string, roomId: string): Promise<void> {
    return fetchApi<void>(`/residences/${residenceId}/rooms/${roomId}`, {
      method: 'DELETE',
    })
  },
}
