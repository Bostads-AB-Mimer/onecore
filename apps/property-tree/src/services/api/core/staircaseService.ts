import { Staircase } from '../../types'
import { GET } from './baseApi'

export const staircaseService = {
  // Get staircases for a building, optionally filtered by staircase code
  async getByBuildingCode(
    buildingCode: string,
    staircaseCode?: string
  ): Promise<Staircase[]> {
    const { data, error } = await GET('/staircases', {
      params: { query: { buildingCode, staircaseCode } },
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
