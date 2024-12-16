import { Building } from '../types'
import { fetchApi } from './baseApi'

export const buildingService = {
  // Get buildings by property code
  async getByPropertyCode(propertyCode: string): Promise<Building[]> {
    const response = await fetchApi<BuildingListResponse>(`/buildings?propertyCode=${propertyCode}`)
    return response.content
  },

  // Get building by ID
  async getById(id: string): Promise<Building> {
    const response = await fetchApi<BuildingDetailsResponse>(`/buildings/${id}`)
    return response.content
  }
}
