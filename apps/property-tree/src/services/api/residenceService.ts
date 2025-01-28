import { Residence } from '../types'
import { GET } from './baseApi'

export const residenceService = {
  // Get all residences
  async getAll(): Promise<Residence[]> {
    const { data, error } = await GET('/api/residences')
    if (error) throw error
    return data?.content || []
  },
  async searchResidences(query: string): Promise<NavigationItem[]> {
    // In a real app this would be an API call
    // For now we'll search through all residences
    const { data, error } = await GET('/residences')
    if (error) throw error
    
    const residences = data.content || []
    const results: NavigationItem[] = []

    residences.forEach((residence) => {
      if (residence.name.toLowerCase().includes(query.toLowerCase()) ||
          residence.code.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          id: residence.id,
          name: `${residence.name} (${residence.code})`,
          type: 'residence',
          metadata: {
            residenceId: residence.id
          }
        })
      }
    })

    return results
  },
  async getByBuildingCode(buildingCode: string) {
    const { data, error } = await GET(`/api/residences`, {
      params: { query: { buildingCode: buildingCode } },
    })
    if (error) throw error
    return data?.content as Residence[]
  },

  async getById(id: string) {
    const { data, error } = await GET(`/api/residences/{id}`, {
      params: { path: { id } },
    })
    if (error) throw error
    return data.content
  },
}
