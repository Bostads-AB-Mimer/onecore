import { Company } from '../types'
import { GET } from './core/base-api'

export const propertyService = {
  // Get all properties

  async getFromCompany(company: Company) {
    const { data, error } = await GET('/propertyBase/properties', {
      params: { query: { companyCode: company.code } },
    })
    if (error) throw error
    return data?.content
  },

  async getPropertyById(propertyId: string) {
    const { data, error } = await GET(`/propertyBase/properties/{propertyId}`, {
      params: { path: { propertyId } },
    })
    if (error) throw error
    return data?.content
  },
}
