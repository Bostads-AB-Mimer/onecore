import { GET } from './baseApi'
import type { components } from './generated/api-types'

type Building = components['schemas']['Building']

export const buildingService = {
  async getByPropertyCode(propertyCode: string) {
    const { data, error } = await GET('/buildings', {
      params: { query: { propertyCode } },
    })
    if (error) throw error
    return data?.content as Building[]
  },

  // Fetch by xpand id code (not internal id)
  async getByBuildingCode(buildingCode: string) {
    const { data, error } = await GET(
      '/buildings/by-building-code/{buildingCode}',
      {
        params: { path: { buildingCode } },
      }
    )
    if (error) throw error
    return data?.content as Building
  },

  async getById(id: string) {
    const { data, error } = await GET('/buildings/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content
  },
}
