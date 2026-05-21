import { GET } from './baseApi'

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
