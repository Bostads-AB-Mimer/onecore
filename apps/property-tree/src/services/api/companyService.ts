import { Company } from '../types'
import { GET } from './baseApi'

export const companyService = {
  // Get all companies
  async getAll(): Promise<Company[]> {
    const { data, error } = await GET('/companies')
    if (error) throw error
    return data.content || []
  },

  // Get company by ID
  async getById(companyId: string): Promise<Company | null> {
    const { data, error } = await GET('/companies/{id}', {
      params: {
        path: { id: companyId },
      },
    })
    if (error) throw error
    return data.content || null
  },
}
