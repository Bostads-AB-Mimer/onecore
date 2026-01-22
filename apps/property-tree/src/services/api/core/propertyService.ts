import { Company } from '../../types'
import { GET } from './base-api'

export interface PropertySearchResult {
  id: string
  code: string
  designation: string
  tract: string
}

export const propertyService = {
  // Get all properties

  async getFromCompany(company: Company) {
    const { data, error } = await GET('/properties', {
      params: { query: { companyCode: company.code } },
    })
    if (error) throw error
    return data?.content
  },

  async getPropertyById(propertyId: string) {
    const { data, error } = await GET(`/properties/{propertyId}`, {
      params: { path: { propertyId } },
    })
    if (error) throw error
    return data?.content
  },

  async searchProperties(q: string): Promise<PropertySearchResult[]> {
    const { data, error } = await GET('/properties/search', {
      params: { query: { q } },
    })
    if (error) throw error
    return (data?.content || []) as PropertySearchResult[]
  },
}
