import { Residence } from '../types'
import { fetchApi } from './baseApi'

export const residenceService = {
  async getByBuildingId(buildingId: string): Promise<Residence[]> {
    const response = await fetchApi<{ content: Residence[] }>(
      `/buildings/${buildingId}/residences`
    )
    return response.content
  },

  async getById(id: string): Promise<Residence> {
    return fetchApi<Residence>(`/residences/${id}`)
  },
}
