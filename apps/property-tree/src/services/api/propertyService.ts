import { Company } from '../types'
import { GET } from './core/base-api'
// FIXME: There is currently no GET /propertyBase/properties/{id} in onecore-core
import { GET as LegacyGET } from './baseApi'

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
    const { data, error } = await LegacyGET(`/properties/{id}`, {
      params: { path: { id: propertyId } },
    })
    if (error) throw error
    return data?.content
  },
}
