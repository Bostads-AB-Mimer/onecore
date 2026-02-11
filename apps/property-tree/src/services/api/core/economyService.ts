import { MiscellaneousInvoicePayload } from '@/components/economy/types'
import { GET, POST } from './base-api'
import { Invoice, InvoicePaymentEvent } from '@onecore/types'

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

async function getInvoicePaymentEvents(
  invoiceId: string
): Promise<InvoicePaymentEvent[]> {
  const { data, error } = await GET(
    //@ts-ignore
    `/invoices/${invoiceId}/payment-events`,
    {
      params: { path: { invoiceId } },
    }
  )

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content as InvoicePaymentEvent[]
}

async function submitMiscellaneousInvoice(
  invoice: MiscellaneousInvoicePayload
) {
  const formData = new FormData()

  if (invoice.attachment) {
    const attachmentBytes = await invoice.attachment.bytes()
    formData.append(
      'attachment',
      new Blob([attachmentBytes]),
      invoice.attachment.name
    )
    delete invoice['attachment']
  }

  formData.append('invoice', JSON.stringify(invoice))

  const { data, error } = await POST(
    // @ts-ignore
    `/invoices/miscellaneous`,
    {
      body: formData,
    }
  )

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  return response
}

export const economyService = {
  getInvoicesByContactCode,
  getInvoicePaymentEvents,
  submitMiscellaneousInvoice,
}
