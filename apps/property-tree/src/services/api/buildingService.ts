import { GET, POST } from './baseApi'
import type { components } from './generated/api-types'

type Building = components['schemas']['Building']

export const buildingService = {
  // Get all buildings
  async getAll(): Promise<Building[]> {
    const { data, error } = await GET('/api/buildings')
    if (error) throw error
    return data?.content || []
  },
  async searchBuildings(query: string): Promise<NavigationItem[]> {
    // In a real app this would be an API call
    // For now we'll search through all buildings
    const { data, error } = await GET('/buildings')
    if (error) throw error

    const buildings = data.content || []
    const results: NavigationItem[] = []

    buildings.forEach((building) => {
      if (
        building.name.toLowerCase().includes(query.toLowerCase()) ||
        building.code.toLowerCase().includes(query.toLowerCase())
      ) {
        results.push({
          id: building.id,
          name: building.name,
          type: 'building',
          metadata: {
            buildingId: building.id,
          },
        })
      }
    })

    return results
  },
  // Get buildings by property code
  async getByPropertyCode(propertyCode: string) {
    const { data, error } = await GET('/api/buildings', {
      params: { query: { propertyCode } },
    })
    if (error) throw error
    return data?.content as Building[]
  },

  // Get building by ID
  async getById(id: string) {
    const { data, error } = await GET('/api/buildings/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as Building
  },
}
