import { GET } from './base-api'
import { Invoice } from '@onecore/types'

// TODO: Fix the ts-ignore by updating the OpenAPI spec
// Economy service is not properly set up for swagger generation :(

async function getInvoicesByContactCode(
  contactCode: string
): Promise<Invoice[]> {
  const { data, error } = await GET(
    //@ts-ignore
    `/invoices/by-contact-code/${contactCode}`,
    {
      params: { path: { contactCode } },
    }
  )

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content.data as Invoice[]
}

export const economyService = { getInvoicesByContactCode }
