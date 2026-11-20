import { z } from 'zod'

// Why an invoice is still open, whatever system it was invoiced in.
// new: sent and not yet due. unmatched: a payment has come in but is not yet
// matched to the invoice. overdue: past its due date. partially-paid: some
// of it is paid. reminded: a reminder has been sent. deferred: payment has
// been deferred (anstånd).
export const OpenInvoiceStateSchema = z.enum([
  'new',
  'unmatched',
  'overdue',
  'partially-paid',
  'reminded',
  'deferred',
])

// An invoice that is not paid, credited or cancelled, and still has money
// left to pay.
export const OpenInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  ocr: z.string().nullable(),
  // Days as yyyy-mm-dd, in Swedish time. Null when the invoicing system
  // sent no valid date.
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  amount: z.number(),
  // What is left to pay, always above 0.
  remainingAmount: z.number(),
  rentalObjectCode: z.string().nullable(),
  leaseId: z.string().nullable(),
  // The tenant the invoice was sent to.
  contactCode: z.string().nullable(),
  state: OpenInvoiceStateSchema,
  // The rental object's cost centre. Null when it has none.
  costCentre: z.string().nullable(),
})

// Error codes GET /invoices/open answers with in `error`.
export const OpenInvoicesErrorCodeSchema = z.enum([
  // The invoicing system or the cost centre lookup could not be read.
  'upstream-failed',
  'unknown',
])
