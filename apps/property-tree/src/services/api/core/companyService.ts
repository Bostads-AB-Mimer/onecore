import { Company } from '../../types'
import { GET as LegacyGET } from '../baseApi'
import { GET } from './base-api'

export const companyService = {
  // Get all companies
  async getAll(): Promise<Company[]> {
    const { data, error } = await GET('/companies', {
      params: {
        query: { limit: 100 },
      },
    })
    if (error) throw error
    return data.content || []
  },

  // Get company by ID
  // TODO: This one is being called by the old baseApi, needs to be migrated to the new one
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
