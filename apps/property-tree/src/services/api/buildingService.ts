import { Building } from '../types'
import { fetchApi } from './baseApi'

export const buildingService = {
  // Get all buildings
  async getAll(): Promise<Building[]> {
    const response = await fetchApi<{content: Building[]}>('/buildings/')
    return response.content
  },

  // Get building by ID 
  async getById(id: string): Promise<Building> {
    return fetchApi<Building>(`/buildings/${id}`)
  },

  // Get buildings by property ID
  async getByPropertyId(propertyId: string): Promise<Building[]> {
    const response = await fetchApi<{content: Building[]}>(`/properties/${propertyId}/buildings/`)
    return response.content
  }
}
