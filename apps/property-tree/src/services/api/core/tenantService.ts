import type {
  BulkEmailResult,
  BulkSmsResult,
  RelatedContact,
  Tenant,
} from '@/services/types'

import { GET, POST } from './baseApi'
import type { paths } from './generated/api-types'

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

async function getRelatedContacts(
  contactCode: string
): Promise<RelatedContact[]> {
  const { data, error } = await GET('/v1/contacts/{contactCode}', {
    params: { path: { contactCode } },
  })

  if (error) throw error

  return data?.content?.relatedContacts ?? []
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
  recipients: { contactCode: string; phoneNumber: string }[],
  text: string
): Promise<{ content: BulkSmsResult; warnings?: string[] }> {
  const { data, error } = await POST('/sendBulkSms', {
    body: { recipients, text },
  })

  if (error) throw error
  if (!data?.content) throw new Error('Response ok but missing content')

  // warnings is a sibling of content: the SMS sent, but a non-blocking issue
  // occurred (e.g. communication-log write failed).
  return { content: data.content, warnings: data.warnings }
}

async function sendBulkEmail(
  recipients: { contactCode: string; emailAddress: string }[],
  subject: string,
  text: string
): Promise<{ content: BulkEmailResult; warnings?: string[] }> {
  const { data, error } = await POST('/sendBulkEmail', {
    body: { recipients, subject, text },
  })

  if (error) throw error
  if (!data?.content) throw new Error('Response ok but missing content')

  // warnings is a sibling of content: the email sent, but a non-blocking issue
  // occurred (e.g. communication-log write failed).
  return { content: data.content, warnings: data.warnings }
}

export type CreateContactRequestBody = NonNullable<
  paths['/v1/contacts']['post']['requestBody']
>['content']['application/json']

export type CreateContactResponse =
  paths['/v1/contacts']['post']['responses'][201]['content']['application/json']

/** Error body shared by every non-2xx response from POST /v1/contacts. */
export type CreateContactError = { error: string; detail?: string }

async function createContact(
  body: CreateContactRequestBody
): Promise<CreateContactResponse> {
  const { data, error } = await POST('/v1/contacts', { body })

  if (error) throw error

  return data
}

export const tenantService = {
  getByContactCode,
  getContactByContactCode,
  getRelatedContacts,
  searchContacts,
  sendBulkSms,
  sendBulkEmail,
  createContact,
}
