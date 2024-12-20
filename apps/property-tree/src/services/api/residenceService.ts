import { Residence } from '../types'
import { GET } from './baseApi'

export const residenceService = {
  async getByBuildingCode(buildingCode: string): Promise<Residence[]> {
    const { data, error } = await GET(`/residences`, {
      params: { query: { buildingCode: buildingCode } },
    })
    if (error) throw error
    return data?.content as Residence[]
  },

  async getById(id: string): Promise<Residence> {
    const { data, error } = await GET(`/residences/{id}`, {
      params: { path: { id } },
    })
    if (error) throw error
    return data as Residence
  },
}
