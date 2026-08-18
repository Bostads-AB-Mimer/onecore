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

export const kvvAreaService = {
  async updateResponsible(id: string, keycloakUserId: string): Promise<void> {
    const { error } = await PATCH('/kvv-areas/{id}/responsible', {
      params: { path: { id } },
      body: { keycloakUserId },
    })
    if (error) throw error
  },
}
