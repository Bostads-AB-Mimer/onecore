import { Company, Property, CompanyDetails } from '../types'
import { GET } from './baseApi'

export const propertyService = {
  // Get all properties using HATEOAS link
  async getFromCompany(company: Company): Promise<Property[]> {
    const { data, error } = await GET('/properties', {
      params: { query: { companyCode: company.code } },
    })
    if (error) throw error
    return data?.content as Property[]
  },

  async getPropertyById(propertyId: string) {
    const { data, error } = await GET(`/properties/{id}`, {
      params: { path: { id: propertyId } },
    })
    if (error) throw error
    return data?.content
  },
  },

  // Get company by ID
  async getCompany(companyId: string): Promise<CompanyDetails> {
    const { data, error } = await GET(`/companies/${companyId}`)
    if (error) throw error
    return data as CompanyDetails
  },
