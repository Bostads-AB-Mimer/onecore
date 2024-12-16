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

  async getByBuildingCode(buildingCode: string): Promise<Residence[]> {
    const response = await fetchApi<{content: Residence[]}>(`/residences/buildingCode/${buildingCode}`)
    return response.content
  },

  async getByBuildingAndStaircase(buildingCode: string, staircaseCode: string): Promise<Residence[]> {
    const response = await fetchApi<{content: Residence[]}>(`/residences/buildingCode/${buildingCode}/staircase/${staircaseCode}`)
    return response.content
  },
}
