import { economy, LeaseStatus } from '@onecore/types'
import z from 'zod'

// A row of the list of open invoices: economy's open invoice with the lease
// status from leasing and the tenant's name and address from the contacts
// service.
export const OpenInvoiceReportRowSchema = economy.OpenInvoiceSchema.extend({
  // Null when leasing has no such lease, or the invoice names none. Never
  // null because a lease could not be read: that fails the whole list.
  leaseStatus: z.nativeEnum(LeaseStatus).nullable(),
  // From the contacts service only. Null when it fails, when the contact has
  // a protected identity or when it has no record of the contact.
  fullName: z.string().nullable(),
  address: z.string().nullable(),
  // Days from the due date to today, negative before it. Null without a
  // due date.
  daysPastDue: z.number().int().nullable(),
})

// Error codes the open invoice routes answer with in `error`.
export const OpenInvoiceReportErrorCodeSchema = z.enum([
  // Leasing's lease cache is loading for the first time. Retry after the
  // Retry-After header.
  'cache-warming',
  'upstream-failed',
  'unknown',
])

export const OpenInvoiceReportErrorResponseSchema = z.object({
  error: OpenInvoiceReportErrorCodeSchema,
  reason: z.string(),
})

export type OpenInvoiceReportRow = z.infer<typeof OpenInvoiceReportRowSchema>
export type OpenInvoiceReportErrorCode = z.infer<
  typeof OpenInvoiceReportErrorCodeSchema
>
