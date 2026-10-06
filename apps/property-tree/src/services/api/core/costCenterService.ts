import { GET, PATCH } from './baseApi'

export const costCenterService = {
  async getAll() {
    const { data, error } = await GET('/cost-centers')
    if (error) throw error
    return data?.content || []
  },

  async getTreeById(id: string) {
    const { data, error } = await GET('/cost-centers/{id}/tree', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content
  },
}

export type KvvAreaResolveParams =
  { rentalId: string } | { buildingCode: string } | { propertyCode: string }

export const kvvAreaService = {
  // Resolves the KVV-area, district and responsible kvartersvärd of a
  // location. Returns null when the location has no KVV-area (404).
  async resolve(params: KvvAreaResolveParams) {
    const { data, error, response } = await GET('/kvv-areas/resolve', {
      params: { query: params },
    })
    if (response.status === 404) return null
    if (error) throw error
    return data?.content ?? null
  },

  async updateResponsible(id: string, keycloakUserId: string): Promise<void> {
    const { error } = await PATCH('/kvv-areas/{id}/responsible', {
      params: { path: { id } },
      body: { keycloakUserId },
    })
    if (error) throw error
  },
}
