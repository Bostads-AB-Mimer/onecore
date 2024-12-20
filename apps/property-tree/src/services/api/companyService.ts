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
    const companies = await this.getAll()
    return companies.find((company) => company.id === companyId) || null
  },
}
