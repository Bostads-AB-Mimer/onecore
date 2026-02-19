import { Company, CompanyDetails } from '../../types'
import { GET } from './baseApi'

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

  // Get company by organization number
  async getByOrganizationNumber(
    organizationNumber: string
  ): Promise<CompanyDetails | null> {
    const { data, error } = await GET('/companies/{organizationNumber}', {
      params: {
        path: { organizationNumber },
      },
    })
    if (error) throw error
    return data.content || null
  },
}
