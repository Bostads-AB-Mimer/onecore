import { GET } from './baseApi'
import type { Tenant } from '@/services/types'

export interface ContactSearchResult {
  fullName: string
  contactCode: string
}

async function getByContactCode(contactCode: string): Promise<Tenant> {
  const { data, error } = await GET('/tenants/by-contact-code/{contactCode}', {
    params: { path: { contactCode } },
  })

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content as Tenant
}

async function getContactByContactCode(contactCode: string): Promise<any> {
  const { data, error } = await GET('/contacts/{contactCode}', {
    params: {
      path: { contactCode },
      query: { includeTerminatedLeases: 'true' },
    },
  })

  if (error) throw error

  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content
}

async function searchContacts(query: string): Promise<ContactSearchResult[]> {
  const { data, error } = await GET('/contacts/search', {
    params: { query: { q: query } },
  })

  if (error) throw error

  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content as ContactSearchResult[]
}

export const tenantService = {
  getByContactCode,
  getContactByContactCode,
  searchContacts,
}
