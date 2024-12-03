import { Staircase } from '../types'
import { fetchApi } from './baseApi'

export const staircaseService = {
  // Get all staircases
  async getAll(): Promise<Staircase[]> {
    const response = await fetchApi<{content: Staircase[]}>('/staircases/')
    return response.content
  },

  // Get staircase by ID
  async getById(id: string): Promise<Staircase> {
    return fetchApi<Staircase>(`/staircases/${id}`)
  },

  // Get staircases by building ID
  async getByBuildingId(buildingId: string): Promise<Staircase[]> {
    const response = await fetchApi<{content: Staircase[]}>(`/buildings/${buildingId}/staircases/`)
    return response.content
  }
}
