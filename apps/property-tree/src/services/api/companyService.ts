import { GET } from './baseApi'

export const companyService = {
  // Get all companies
  async getAll() {
    const { data, error } = await GET('/companies')
    if (error) throw error
    console.log('companies', data)
    return data?.content
  },
}
