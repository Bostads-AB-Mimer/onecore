import { Residence } from '../types'
import { fetchApi } from './baseApi'

export const residenceService = {
  async getAll(residenceType?: string): Promise<Residence[]> {
    const url = residenceType ? `/residences/?residenceType=${residenceType}` : '/residences/'
    const response = await fetchApi<{content: Residence[]}>(url)
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
