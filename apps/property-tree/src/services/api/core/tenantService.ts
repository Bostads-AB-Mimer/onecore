import type { BulkEmailResult, BulkSmsResult, Tenant } from '@/services/types'

import { GET, POST } from './baseApi'

export interface ContactSearchResult {
  fullName: string
  contactCode: string
  protectedIdentity?: boolean
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

async function sendBulkSms(
  recipients: { kundId?: string; phoneNumber: string }[],
  text: string
): Promise<BulkSmsResult> {
  const { data, error } = await POST('/sendBulkSms', {
    body: { recipients, text },
  })

  if (error) throw error
  if (!data?.content) throw new Error('Response ok but missing content')

  return data.content
}

async function sendBulkEmail(
  recipients: { kundId?: string; emailAddress: string }[],
  subject: string,
  text: string
): Promise<BulkEmailResult> {
  const { data, error } = await POST('/sendBulkEmail', {
    body: { recipients, subject, text },
  })

  if (error) throw error
  if (!data?.content) throw new Error('Response ok but missing content')

  return data.content
}

export const tenantService = {
  getByContactCode,
  getContactByContactCode,
  searchContacts,
  sendBulkSms,
  sendBulkEmail,
}
