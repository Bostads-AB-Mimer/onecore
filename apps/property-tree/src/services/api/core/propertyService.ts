import type { Company } from '../../types'
import { GET, PUT } from './baseApi'
import type { components } from './generated/api-types'

/** Display-only type for property search results */
interface PropertySearchResult {
  id: string
  code: string
  designation: string
  tract: string
}

export type PropertyKvvAreaLink = components['schemas']['PropertyKvvAreaLink']

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

  async updateKvvArea(
    propertyCode: string,
    kvvAreaId: string
  ): Promise<PropertyKvvAreaLink> {
    const { data, error } = await PUT('/properties/{propertyCode}/kvv-area', {
      params: { path: { propertyCode } },
      body: { kvvAreaId },
    })
    if (error) throw error
    if (!data?.content) throw new Error('Empty response')
    return data.content
  },
}
