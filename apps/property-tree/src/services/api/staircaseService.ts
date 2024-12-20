import { GET } from './baseApi'
import type { Staircase } from '../types'

export const staircaseService = {
  // Get all staircases for a building
  async getByBuildingCode(buildingCode: string): Promise<Staircase[]> {
    const { data, error } = await GET('/staircases', {
      params: { query: { buildingCode } },
    })
    if (error) throw error
    return data?.content || []
  },

  // Get staircase by ID
  async getById(id: string): Promise<Staircase> {
    const { data, error } = await GET(`/staircases/${id}`)
    if (error) throw error
    return data as Staircase
  }
}
