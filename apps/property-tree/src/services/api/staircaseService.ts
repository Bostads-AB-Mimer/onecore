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
  async getByBuildingCodeAndId(
    buildingCode: string,
    id: string
  ): Promise<Staircase> {
    const staircases = await this.getByBuildingCode(buildingCode)
    const staircase = staircases.find((staircase) => staircase.id === id)
    if (!staircase) throw new Error('Staircase not found')
    return staircase
  },
}
