import { ApiError, GET } from './baseApi'
import type { components } from './generated/api-types'

export type OpenInvoiceReportRow = components['schemas']['OpenInvoiceReportRow']

// The report has no paging or filters: core returns every open invoice,
// oldest due date first.
async function list(): Promise<OpenInvoiceReportRow[]> {
  const { data, error, response } = await GET('/reports/open-invoices', {})

  // A 403 has no JSON body, so error can be undefined: check data instead.
  if (!data)
    throw new ApiError(response.status, 'open invoices failed', error?.error)

  return data.content
}

async function exportToExcel(): Promise<Blob> {
  const { data, error, response } = await GET('/reports/open-invoices/export', {
    parseAs: 'blob',
  })

  if (!data)
    throw new ApiError(
      response.status,
      'open invoices export failed',
      error?.error
    )

  // openapi-typescript types binary responses as `string`, but parseAs:'blob'
  // makes openapi-fetch return an actual Blob at runtime.
  return data as unknown as Blob
}

export const openInvoiceReportService = { list, exportToExcel }
