import { Residence } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockResidences } from '../mockData'

export const residenceService = {
  // Get all residences
  async getAll(): Promise<Residence[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return Object.values(mockResidences)
  },

  // Get residence by ID
  async getById(id: string): Promise<Residence> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const residence = mockResidences[id]
    if (!residence) {
      throw new Error(`Residence with id ${id} not found`)
    }
    return residence
  },

  // Create new residence
  async create(data: Omit<Residence, 'id'>): Promise<Residence> {
    // TODO: Replace with actual API call
    return fetchApi<Residence>('/residences', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update residence
  async update(id: string, data: Partial<Residence>): Promise<Residence> {
    // TODO: Replace with actual API call
    return fetchApi<Residence>(`/residences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete residence
  async delete(id: string): Promise<void> {
    // TODO: Replace with actual API call
    return fetchApi<void>(`/residences/${id}`, {
      method: 'DELETE',
    })
  },

  // Get residences by entrance ID
  async getByEntranceId(entranceId: string): Promise<Residence[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return Object.values(mockResidences).filter(
      (residence) => residence.entranceId === entranceId,
    )
  },
}
