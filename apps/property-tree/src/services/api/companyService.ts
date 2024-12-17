import { GET } from './baseApi'
import type { components } from './generated/api-types'

type Company = components['schemas']['Company']
type Property = components['schemas']['Property']

export const companyService = {
  // Get all companies
  async getAll() {
    const { data, error } = await GET('/companies', {})
    if (error) throw error
    return data?.content as Company[]
  },

  // Get company by ID
  async getById(id: string) {
    const { data, error } = await GET('/companies/{id}', {
      params: { path: { id } }
    })
    if (error) throw error
    return data?.content as Company
  },

  // Get properties for a company
  async getCompanyProperties(companyId: string) {
    const { data, error } = await GET('/companies/{companyId}/properties', {
      params: { path: { companyId } }
    })
    if (error) throw error
    return data?.content as Property[]
  }
}
