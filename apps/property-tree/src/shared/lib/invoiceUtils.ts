/**
 * Extracts an invoice number from a search query.
 *
 * Xledger invoice numbers are long digit-only strings (e.g. `552607001503584`),
 * optionally suffixed with `K` for credit invoices. The 7-digit minimum skips
 * short numeric fragments that are never invoice numbers. Unlike errand codes
 * (`od-<number>`), a digit-only query is ambiguous — it may also be a
 * personnummer or phone number — so callers must run the invoice lookup in
 * parallel with the other search sources instead of short-circuiting.
 * Returns the normalized (uppercased) invoice number, otherwise `null`.
 */
export const parseInvoiceNumber = (query: string): string | null => {
  const match = query.trim().match(/^\d{7,20}k?$/i)
  return match ? match[0].toUpperCase() : null
}
