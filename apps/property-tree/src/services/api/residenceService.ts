import { Residence } from '../types'
import { GET } from './baseApi'

export const residenceService = {
  async getByBuildingId(buildingId: string): Promise<Residence[]> {
    const { data, error } = await GET(`/buildings/${buildingId}/residences`)
    if (error) throw error
    return data?.content as Residence[]
  },

  async getById(id: string): Promise<Residence> {
    const { data, error } = await GET(`/residences/${id}`)
    if (error) throw error
    return data as Residence
  },
}
