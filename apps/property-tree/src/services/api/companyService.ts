import {
  Company,
  CompanyDetails,
  CompanyLinks,
  CompanyWithLinks,
} from '../types'
import { fetchApi } from './baseApi'

interface CompanyResponse {
  content: (Company & CompanyLinks)[]
}

interface CompanyDetailsResponse {
  content: CompanyDetails & CompanyLinks
}

export const companyService = {
  // Get all companies
  async getAll(): Promise<CompanyWithLinks[]> {
    const response = await fetchApi<CompanyResponse>('/companies/')
    return response.content
  },

  // Get company by ID
  async getById(id: string): Promise<CompanyDetails> {
    const response = await fetchApi<CompanyDetailsResponse>(`/companies/${id}`)
    return response.content
  },

  // Get properties for a company using the HATEOAS link
  async getCompanyProperties(company: CompanyWithLinks) {
    return fetchApi(company._links.properties.href)
  },
}
