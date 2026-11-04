import z from 'zod'

export const RentalInvoiceExportErrorSchema = z.object({
  invoiceNumber: z.string(),
  error: z.string(),
})

export const MarkInvoiceAsExportedFailureSchema = z.object({
  invoiceNumber: z.string(),
  error: z.enum(['missing-external-id', 'request-failed']),
  status: z.number().optional(),
})

// Response of POST /accounting/import-invoices/:companyId
export const ImportInvoicesResponseSchema = z.object({
  errors: z.array(RentalInvoiceExportErrorSchema),
  successfulInvoices: z.array(z.string()),
  skippedInvoices: z.array(z.string()),
  // Invoices that were uploaded to Xledger but could not be marked as
  // exported in Tenfast. They must be marked manually before the next run.
  markFailures: z.array(MarkInvoiceAsExportedFailureSchema),
})

export const ImportInvoicesErrorResponseSchema = z.object({
  error: z.enum(['partial-upload', 'export-failed']),
  reason: z.string(),
  // Files that reached Xledger before the failure (set for 'partial-upload').
  uploadedFiles: z.array(z.string()).optional(),
})

export type RentalInvoiceExportError = z.infer<
  typeof RentalInvoiceExportErrorSchema
>
export type MarkInvoiceAsExportedFailure = z.infer<
  typeof MarkInvoiceAsExportedFailureSchema
>
export type ImportInvoicesResponse = z.infer<
  typeof ImportInvoicesResponseSchema
>
export type ImportInvoicesErrorResponse = z.infer<
  typeof ImportInvoicesErrorResponseSchema
>
