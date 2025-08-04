import { Company } from '../types'
import { GET as LegacyGET } from './baseApi'
import { GET } from './core/base-api'

export const companyService = {
  // Get all companies
  async getAll(): Promise<Company[]> {
    const { data, error } = await GET('/propertyBase/companies', {
      params: {
        query: { limit: 100 },
      },
    })
    if (error) throw error
    return data.content || []
  },

  // Get company by ID
  async getById(companyId: string): Promise<Company | null> {
    const { data, error } = await LegacyGET('/companies/{id}', {
      params: {
        path: { id: companyId },
      },
    })
    if (error) throw error
    return data.content || null
  },
}
