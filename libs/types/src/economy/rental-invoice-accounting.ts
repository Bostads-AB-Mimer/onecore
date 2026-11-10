import z from 'zod'

// Why an invoice was left out of the rental invoice accounting export.
export const RentalInvoiceExportErrorCodeSchema = z.enum([
  // A row on the invoice has no rent article.
  'missing-rent-article',
  // The rent article on a row does not exist in Tenfast.
  'rent-article-not-found',
  // The rent article could not be fetched from Tenfast (network, schema, ...).
  'rent-article-fetch-failed',
  // The rent article has no account configurations at all.
  'rent-article-missing-accounts',
  // The rent article has no account configuration for income (Intäkter).
  'rent-article-missing-income-account',
  // A row that requires a rental object has none.
  'missing-rental-object',
  // Xpand has no round-off (ORESUTJ) account for the invoice year.
  'missing-round-off-account',
  // Any other failure while adding accounting to the invoice.
  'accounting-failed',
  // The invoice asked for by OCR number does not exist in Tenfast.
  'invoice-not-found',
  // The invoice asked for by OCR number could not be fetched from Tenfast.
  'invoice-fetch-failed',
])

export const RentalInvoiceExportErrorSchema = z.object({
  invoiceNumber: z.string(),
  code: RentalInvoiceExportErrorCodeSchema,
  // Human-readable (Swedish) description, shown to economy staff.
  error: z.string(),
  // The rent article the error concerns: its Tenfast id when the article
  // could not be resolved, otherwise its code.
  rentArticle: z.string().optional(),
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

export type RentalInvoiceExportErrorCode = z.infer<
  typeof RentalInvoiceExportErrorCodeSchema
>
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
