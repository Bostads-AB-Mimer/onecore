import {
  Company,
  CompanyDetails,
  CompanyLinks,
  CompanyWithLinks,
  PropertyWithLinks,
} from '../types'
import { fetchApi } from './baseApi'
import { Property } from './schemas'

interface CompanyResponse {
  content: CompanyWithLinks[]
}

interface CompanyDetailsResponse {
  content: CompanyWithLinks
}

interface CompanyPropertiesResponse {
  content: PropertyWithLinks[]
}

export const companyService = {
  // Get all companies
  async getAll(): Promise<CompanyWithLinks[]> {
    const response = await fetchApi<CompanyResponse>('/companies/')
    return response.content.map(company => ({
      ...company,
      id: company.propertyObjectId // Map propertyObjectId to id for compatibility
    }))
  },

  // Get company by ID
  async getById(id: string): Promise<CompanyDetails> {
    const response = await fetchApi<CompanyDetailsResponse>(`/companies/${id}`)
    return response.content
  },

  // Get properties for a company using the HATEOAS link
  async getCompanyProperties(company: CompanyWithLinks) {
    console.log('getting company properties', company)
    const response = await fetchApi<CompanyPropertiesResponse>(
      company._links.properties.href
    )
    console.log('response', response)
    return response.content
  },
}
