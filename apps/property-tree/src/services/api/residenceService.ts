import { Residence, ResidenceDetails } from '../types'
import { GET } from './baseApi'

export const residenceService = {
  async getByBuildingCode(buildingCode: string): Promise<Residence[]> {
    const { data, error } = await GET('/residences', {
      params: { query: { buildingCode } },
    })
    if (error) throw error
    return data.content || []
  },

  async getById(id: string): Promise<ResidenceDetails> {
    const { data, error } = await GET('/residences/{id}', {
      params: { path: { id } },
    })

    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')

    return data.content
  },
}
