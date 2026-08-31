/**
 * Extracts an invoice number from a search query.
 *
 * Xledger invoice numbers come in two shapes: avier are 15-digit strings
 * (e.g. `552607001503584`) while ströfakturor are short sequential numbers
 * starting at 10001 (5–6 digits). Both may carry a `K` suffix for credit
 * invoices. The 7–12 digit gap is excluded on purpose — personnummer (10/12
 * digits) and phone numbers (8–10) fall there, and every lookup is a paid
 * Xledger call. Unlike errand codes (`od-<number>`), a digit-only query is
 * still ambiguous, so callers must run the invoice lookup in parallel with
 * the other search sources instead of short-circuiting.
 * Returns the normalized (uppercased) invoice number, otherwise `null`.
 */
export const parseInvoiceNumber = (query: string): string | null => {
  const match = query.trim().match(/^(\d{5,6}|\d{13,20})k?$/i)
  return match ? match[0].toUpperCase() : null
}
