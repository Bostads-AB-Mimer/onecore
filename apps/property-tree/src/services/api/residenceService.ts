import { Residence } from '../types'
import { fetchApi } from './baseApi'

export const residenceService = {
  async getByBuildingCode(buildingCode: string, floorCode?: string): Promise<Residence[]> {
    const url = new URL('/residences', API_BASE_URL)
    url.searchParams.append('buildingCode', buildingCode)
    if (floorCode) {
      url.searchParams.append('floorCode', floorCode)
    }
    const response = await fetchApi<{content: Residence[]}>(url.toString())
    return response.content
  },

  async getById(id: string): Promise<Residence> {
    return fetchApi<Residence>(`/residences/${id}`)
  },

  async getByBuildingId(buildingId: string): Promise<Residence[]> {
    const response = await fetchApi<{content: Residence[]}>(`/buildings/${buildingId}/residences`)
    return response.content
  },

  async getByStaircaseId(staircaseId: string): Promise<Residence[]> {
    const response = await fetchApi<{content: Residence[]}>(`/staircases/${staircaseId}/residences`)
    return response.content
  },
}
