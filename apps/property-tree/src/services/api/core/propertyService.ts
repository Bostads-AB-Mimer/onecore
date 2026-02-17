import type { Company } from '../../types'
import { GET } from './baseApi'

/** Display-only type for property search results */
interface PropertySearchResult {
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

  async getPropertyByCode(propertyCode: string) {
    const { data, error } = await GET(`/properties/{propertyCode}`, {
      params: { path: { propertyCode } },
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
