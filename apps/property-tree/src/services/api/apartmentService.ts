import { Apartment } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockApartments } from '../mockData'

export const apartmentService = {
  // Get all apartments
  async getAll(): Promise<Apartment[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return Object.values(mockApartments)
  },

  // Get apartment by ID
  async getById(id: string): Promise<Apartment> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const apartment = mockApartments[id]
    if (!apartment) {
      throw new Error(`Apartment with id ${id} not found`)
    }
    return apartment
  },

  // Create new apartment
  async create(data: Omit<Apartment, 'id'>): Promise<Apartment> {
    // TODO: Replace with actual API call
    return fetchApi<Apartment>('/apartments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update apartment
  async update(id: string, data: Partial<Apartment>): Promise<Apartment> {
    // TODO: Replace with actual API call
    return fetchApi<Apartment>(`/apartments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete apartment
  async delete(id: string): Promise<void> {
    // TODO: Replace with actual API call
    return fetchApi<void>(`/apartments/${id}`, {
      method: 'DELETE',
    })
  },

  // Get apartments by entrance ID
  async getByEntranceId(entranceId: string): Promise<Apartment[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return Object.values(mockApartments).filter(
      (apartment) => apartment.entranceId === entranceId
    )
  },
}
