import { Company } from '../types'
import { GET } from './baseApi'

export const companyService = {
  // Get all companies
  async getAll(): Promise<Company[]> {
    const { data, error } = await GET('/companies')
    if (error) throw error
    return data?.content || []
  },
}
