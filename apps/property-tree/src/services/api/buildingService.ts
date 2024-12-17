import { GET } from './baseApi'
import type { components } from './generated/api-types'

type Building = components['schemas']['Building']
type Staircase = components['schemas']['Staircase']
type Residence = components['schemas']['Residence']

export const buildingService = {
  // Get buildings by property code
  async getByPropertyCode(propertyCode: string) {
    const { data, error } = await GET('/buildings', {
      params: { query: { propertyCode } }
    })
    if (error) throw error
    return data?.content as Building[]
  },

  // Get building by ID
  async getById(id: string) {
    const { data, error } = await GET('/buildings/{id}', {
      params: { path: { id } }
    })
    if (error) throw error
    return data?.content as Building
  },

  // Get building staircases
  async getBuildingStaircases(buildingId: string) {
    const { data, error } = await GET('/buildings/{id}/staircases', {
      params: { path: { id: buildingId } }
    })
    if (error) throw error
    return data?.content as Staircase[]
  },

  // Get building residences
  async getBuildingResidences(buildingId: string) {
    const { data, error } = await GET('/buildings/{id}/residences', {
      params: { path: { id: buildingId } }
    })
    if (error) throw error
    return data?.content as Residence[]
  }
}
