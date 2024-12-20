import { Company } from '../types'
import { GET } from './baseApi'

export const propertyService = {
  async getFromCompany(company: Company) {
    const { data, error } = await GET('/properties', {
      params: { query: { companyCode: company.code } },
    })
    if (error) throw error
    return data.content
  },

  async getPropertyById(propertyId: string) {
    const { data, error } = await GET(`/properties/{id}`, {
      params: { path: { id: propertyId } },
    })
    if (error) throw error
    return data?.content
  },
}
