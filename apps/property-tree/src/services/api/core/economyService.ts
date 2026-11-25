import {
  economy,
  Invoice,
  InvoicePaymentEvent,
  MiscellaneousInvoice,
  XledgerProject,
} from '@onecore/types'
import { SubmitMiscellaneousInvoiceErrorCodes } from '@onecore/types'
import { MiscellaneousInvoicePayload } from '@onecore/types/src/economy/miscellaneous-invoice'
import { XledgerContact } from '@onecore/types/src/types'

import { ApiError, GET, POST, PUT } from './baseApi'
import type { components, paths } from './generated/api-types'

// TODO: Fix the @ts-expect-error by updating the OpenAPI spec
// Economy service is not properly set up for swagger generation :(

async function getInvoicesByContactCode(
  contactCode: string
): Promise<Invoice[]> {
  const { data, error } = await GET(
    // @ts-expect-error
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

async function getInvoiceByNumber(
  invoiceNumber: string
): Promise<Invoice | null> {
  const { data, error, response } = await GET(
    // @ts-expect-error
    `/invoices/${invoiceNumber}`,
    {
      params: { path: { invoiceId: invoiceNumber } },
    }
  )

  if (response.status === 404) return null
  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const responseData = data as any
  if (!responseData?.content) throw new Error('Response ok but missing content')

  return responseData.content as Invoice
}

async function getInvoicePaymentEvents(
  invoiceId: string
): Promise<InvoicePaymentEvent[]> {
  const { data, error } = await GET(
    // @ts-expect-error
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

async function getInvoiceChannels(recipient: economy.LookupRecipient) {
  const { data, error } = await POST('/invoice-channels', {
    body: {
      recipients: [recipient],
    },
  })

  if (error) throw error

  return data.content
}

async function getAutogiroConsent(nationalRegistrationNumber: string) {
  const { data, error, response } = await GET(
    '/autogiro-consent/{nationalRegistrationNumber}',
    {
      params: {
        path: { nationalRegistrationNumber },
      },
    }
  )

  // 404 means the tenant has no autogiro consent, which is a normal answer
  if (response.status === 404) return null
  if (error) throw error

  return data.content
}

async function getMiscellaneousInvoiceDataForLease(
  leaseId: string
): Promise<{ costCentre: string; propertyCode: string } | null> {
  const rentalId = leaseId.split('/')[0]
  const { data, error } = await GET(
    // @ts-expect-error
    `/invoices/miscellaneous/${rentalId}`,
    {
      params: {
        path: { rentalId },
      },
    }
  )

  if (error) {
    console.log('error', error)
    throw error
  }

  // @ts-expect-error
  return data.content.data
}

async function getMiscellaneousInvoices({
  from,
  to,
  after,
  pageSize,
}: {
  from?: string
  to?: string
  after?: string
  pageSize?: number
} = {}): Promise<{
  content: MiscellaneousInvoice[]
  pageInfo: { hasNextPage: boolean; endCursor?: string }
}> {
  const { data, error } = await GET(
    // @ts-expect-error
    `/miscellaneous-invoices`,
    { params: { query: { from, to, after, pageSize } } }
  )

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content as {
    content: MiscellaneousInvoice[]
    pageInfo: { hasNextPage: boolean; endCursor?: string }
  }
}

/**
 * Core rejected or failed a miscellaneous invoice. `code` is the error code
 * core returned, if any.
 */
export class SubmitMiscellaneousInvoiceError extends ApiError {
  constructor(
    status: number,
    public code: SubmitMiscellaneousInvoiceErrorCodes | undefined
  ) {
    super(
      status,
      `Failed to submit miscellaneous invoice (status ${status}${code ? `, ${code}` : ''})`
    )
    this.name = 'SubmitMiscellaneousInvoiceError'
  }
}

async function submitMiscellaneousInvoice(
  invoice: MiscellaneousInvoicePayload
) {
  const formData = new FormData()

  const invoiceForSubmission = {
    ...invoice,
    invoiceRows: invoice.invoiceRows.map((row) => ({
      ...row,
      price: parseFloat(row.price),
    })),
  }

  if (invoice.attachment) {
    const attachmentBytes = await invoice.attachment.bytes()
    formData.append(
      'attachment',
      new Blob([attachmentBytes]),
      invoice.attachment.name
    )
    delete invoiceForSubmission['attachment']
  }

  formData.append('invoice', JSON.stringify(invoiceForSubmission))

  const { data, error, response } = await POST(
    // @ts-expect-error
    `/miscellaneous-invoices`,
    {
      body: formData,
    }
  )

  // Branch on the raw status rather than `error` — a non-2xx response with an
  // empty body yields `error: undefined` and must not be treated as success.
  if (!response.ok) {
    // `error` is untyped since the route is missing from the generated types
    const type = (error as { type?: unknown } | undefined)?.type
    throw new SubmitMiscellaneousInvoiceError(
      response.status,
      Object.values(SubmitMiscellaneousInvoiceErrorCodes).find(
        (code) => code === type
      )
    )
  }

  return data
}

async function getXledgerContacts(): Promise<XledgerContact[]> {
  // @ts-expect-error
  const { data, error } = await GET(`/xledger-contacts`, {})

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content as XledgerContact[]
}

async function getXledgerProjects(): Promise<XledgerProject[]> {
  // @ts-expect-error
  const { data, error } = await GET(`/xledger-projects`, {})

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content as XledgerProject[]
}

type DeferralResponses =
  paths['/invoices/{invoiceId}/deferral']['put']['responses']
export type DeferralError =
  | DeferralResponses[422]['content']['application/json']
  | DeferralResponses[404]['content']['application/json']
  | DeferralResponses[500]['content']['application/json']

async function updateInvoiceDeferralDate(params: {
  invoiceId: string
  endDate: string
  reason: string
}): Promise<void> {
  const { error } = await PUT('/invoices/{invoiceId}/deferral', {
    params: { path: { invoiceId: params.invoiceId } },
    body: {
      endDate: params.endDate,
      reason: params.reason,
    },
  })

  if (error) throw error
}

// Null when there is no rent notice PDF for the invoice.
async function getInvoicePdf(invoiceId: string): Promise<Blob | null> {
  const { data, error, response } = await GET('/invoices/{ocr}/pdf', {
    params: { path: { ocr: invoiceId } },
    parseAs: 'blob',
  })

  if (response.status === 404) return null
  if (error || !response.ok) {
    throw new ApiError(
      response.status,
      `Failed to download invoice PDF (status ${response.status})`
    )
  }

  // openapi-typescript types binary responses as `string`, but parseAs:'blob'
  // makes openapi-fetch return an actual Blob at runtime.
  return data as unknown as Blob
}

export type SendInvoiceError = components['schemas']['SendInvoiceEmailError']

// invoiceType lets core skip the rent notice lookup for a miscellaneous
// invoice. contactCode is the contact whose ledger the invoice is sent from,
// so a rent notice on a shared lease goes to that tenant.
async function sendInvoiceToCustomer(params: {
  invoiceId: string
  invoiceType: Invoice['type']
  contactCode?: string
}): Promise<void> {
  const { error, response } = await POST('/invoices/{invoiceId}/send', {
    params: { path: { invoiceId: params.invoiceId } },
    body: { invoiceType: params.invoiceType, contactCode: params.contactCode },
  })

  // Branch on the raw status: a failed response without a body has no
  // `error`, and must not be read as sent.
  if (!response.ok) {
    const sendError: SendInvoiceError = { reason: error?.reason ?? 'unknown' }
    throw sendError
  }
}

export const economyService = {
  getInvoicesByContactCode,
  getInvoiceByNumber,
  getInvoicePaymentEvents,
  getMiscellaneousInvoiceDataForLease,
  getInvoiceChannels,
  getAutogiroConsent,
  getMiscellaneousInvoices,
  submitMiscellaneousInvoice,
  getXledgerContacts,
  getXledgerProjects,
  updateInvoiceDeferralDate,
  getInvoicePdf,
  sendInvoiceToCustomer,
}
