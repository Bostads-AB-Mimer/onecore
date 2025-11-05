import { GET } from './base-api'
import type { Tenant } from '@/services/types'

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

export const tenantService = { getByContactCode }
