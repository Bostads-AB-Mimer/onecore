import { Company, CompanyDetails } from '../types'
import { fetchApi } from './baseApi'

interface CompanyResponse {
  content: (Company & {
    _links: {
      self: { href: string }
      properties: { href: string }
    }
  })[]
}

interface CompanyDetailsResponse {
  content: CompanyDetails & {
    _links: {
      self: { href: string }
      properties: { href: string }
    }
  }
}

export const companyService = {
  // Get all companies
  async getAll(): Promise<Company[]> {
    const response = await fetchApi<CompanyResponse>('/companies/')
    return response.content
  },

  // Get company by ID
  async getById(id: string): Promise<CompanyDetails> {
    const response = await fetchApi<CompanyDetailsResponse>(`/companies/${id}`)
    return response.content
  },

  // Get properties for a company using the HATEOAS link
  async getCompanyProperties(company: Company & { _links: { properties: { href: string } } }) {
    return fetchApi(company._links.properties.href)
  }
}
