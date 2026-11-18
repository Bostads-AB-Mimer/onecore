import { economy, Invoice } from '@onecore/types'

import * as communicationAdapter from '../../adapters/communication-adapter'
import * as economyAdapter from '../../adapters/economy-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import config from '../../common/config'
import {
  isRedactedProtectedIdentity,
  tenantAwareContactLookup,
} from '../../processes/contacts/protected-tenants'

/** Why an invoice email was not sent, one code per failed step. */
export type SendInvoiceEmailFailure =
  | 'invoice-not-found'
  | 'invoice-unknown'
  | 'pdf-not-found'
  | 'pdf-unknown'
  | 'no-lease-id'
  | 'lease-not-found'
  | 'no-contact-code'
  | 'contact-not-found'
  | 'contact-unknown'
  | 'protected-identity'
  | 'no-email'
  | 'missing-expiration-date'
  | 'send-failed'

export type SendInvoiceEmailResult =
  { ok: true } | { ok: false; err: SendInvoiceEmailFailure }

const toDueDate = (expirationDate: Date | string) =>
  new Date(expirationDate).toISOString().split('T')[0]

// Outside production every invoice email goes to the test inbox.
const recipientAddress = (emailAddress: string) =>
  process.env.NODE_ENV !== 'production'
    ? config.emailAddresses.tenantDefault
    : emailAddress

const sendEmail = async (params: {
  emailAddress: string
  firstName: string
  address: string
  invoice: Invoice
  pdf: Buffer
}): Promise<SendInvoiceEmailResult> => {
  if (!params.invoice.expirationDate) {
    return { ok: false, err: 'missing-expiration-date' }
  }

  const result = await communicationAdapter.sendInvoiceNotificationEmail({
    to: recipientAddress(params.emailAddress),
    firstName: params.firstName,
    address: params.address,
    invoiceNumber: params.invoice.invoiceId,
    dueDate: toDueDate(params.invoice.expirationDate),
    totalAmount: String(params.invoice.amount),
    attachments: [
      {
        filename: `faktura-${params.invoice.invoiceId}.pdf`,
        content: params.pdf.toString('base64'),
        contentType: 'application/pdf',
      },
    ],
  })

  return result.ok ? { ok: true } : { ok: false, err: 'send-failed' }
}

type Recipient = { emailAddress: string; firstName: string }

/*
 * Who an invoice email goes to, from a contacts-service lookup. A protected
 * identity the contacts service still returns redacted is not emailed, so the
 * path fails closed.
 */
const toRecipient = (
  contactResult: Awaited<
    ReturnType<typeof tenantAwareContactLookup.getByContactCode>
  >
):
  | { ok: true; data: Recipient }
  | { ok: false; err: SendInvoiceEmailFailure } => {
  if (!contactResult.ok) {
    return {
      ok: false,
      err:
        contactResult.err === 'not-found'
          ? 'contact-not-found'
          : 'contact-unknown',
    }
  }

  const contact = contactResult.data
  if (isRedactedProtectedIdentity(contact)) {
    return { ok: false, err: 'protected-identity' }
  }

  const emailAddress =
    contact.communication.emailAddresses.find((e) => e.isPrimary)
      ?.emailAddress ?? contact.communication.emailAddresses[0]?.emailAddress
  if (!emailAddress) return { ok: false, err: 'no-email' }

  const firstName =
    contact.type === 'individual'
      ? (contact.personal.firstName ?? contact.personal.fullName)
      : contact.organisation.name

  return { ok: true, data: { emailAddress, firstName } }
}

/*
 * Emails a rent notice to the first tenant on its lease, with the PDF that
 * belongs to its OCR number attached. Contact details come from the contacts
 * service; a protected identity that is not revealed is not emailed.
 */
export const sendRentNoticeEmail = async (
  ocr: string
): Promise<SendInvoiceEmailResult> => {
  const [invoiceResult, pdfResult] = await Promise.all([
    economyAdapter.getInvoiceByOcr(ocr),
    economyAdapter.getInvoicePdf(ocr),
  ])

  if (!invoiceResult.ok) {
    return {
      ok: false,
      err:
        invoiceResult.err === 'not-found'
          ? 'invoice-not-found'
          : 'invoice-unknown',
    }
  }
  if (!pdfResult.ok) {
    return {
      ok: false,
      err: pdfResult.err === 'not-found' ? 'pdf-not-found' : 'pdf-unknown',
    }
  }

  const invoice = invoiceResult.data
  const leaseId = invoice.leaseIds[0]
  if (!leaseId) return { ok: false, err: 'no-lease-id' }

  const lease = await leasingAdapter.getLease(leaseId)
  if (!lease) return { ok: false, err: 'lease-not-found' }

  const contactCode = lease.tenantContactIds?.[0]
  if (!contactCode) return { ok: false, err: 'no-contact-code' }

  const recipient = toRecipient(
    await tenantAwareContactLookup.getByContactCode(contactCode)
  )
  if (!recipient.ok) return recipient

  return sendEmail({
    ...recipient.data,
    address: lease.rentalObject?.address ?? '',
    invoice,
    pdf: pdfResult.data.data,
  })
}

/*
 * Emails a miscellaneous invoice to the customer it is billed to, with the PDF
 * from the ledger attached. The customer's contact code is the invoice
 * reference. Contact details come from the contacts service; a protected
 * identity that is not revealed is not emailed.
 */
export const sendMiscellaneousInvoiceEmail = async (
  invoice: Invoice
): Promise<SendInvoiceEmailResult> => {
  const [contactResult, fileResult] = await Promise.all([
    tenantAwareContactLookup.getByContactCode(invoice.reference),
    economyAdapter.getInvoiceFile(invoice.invoiceId),
  ])

  if (!fileResult.ok) {
    return {
      ok: false,
      err: {
        'invoice-not-found': 'invoice-not-found' as const,
        'file-not-found': 'pdf-not-found' as const,
        unknown: 'pdf-unknown' as const,
      }[fileResult.err],
    }
  }
  const recipient = toRecipient(contactResult)
  if (!recipient.ok) return recipient

  return sendEmail({
    ...recipient.data,
    // A miscellaneous invoice is not tied to a rental object.
    address: '',
    invoice,
    pdf: fileResult.data,
  })
}

/*
 * Emails one invoice of either kind. The rent notice lookup goes first: a rent
 * notice exists in the rent system before it reaches the ledger, and that
 * lookup already returns everything the email needs. Only an invoice the rent
 * system does not know is looked up in the ledger.
 *
 * A miscellaneous invoice is never in the rent system, so a caller that knows
 * the invoice is one passes `knownType` and the rent notice lookup is skipped.
 * `knownType` only saves that lookup: the type the ledger reports still
 * decides whether the invoice is emailed as a miscellaneous invoice.
 */
export const sendInvoiceEmail = async (
  invoiceId: string,
  knownType?: Invoice['type']
): Promise<SendInvoiceEmailResult> => {
  if (knownType !== 'Other') {
    const rentNoticeResult = await sendRentNoticeEmail(invoiceId)
    if (rentNoticeResult.ok || rentNoticeResult.err !== 'invoice-not-found') {
      return rentNoticeResult
    }
  }

  const invoiceResult = await economyAdapter.getInvoiceByInvoiceId(invoiceId)
  if (!invoiceResult.ok) {
    return {
      ok: false,
      err:
        invoiceResult.err === 'not-found'
          ? 'invoice-not-found'
          : 'invoice-unknown',
    }
  }

  // A rent notice that is only in the ledger comes from the old rent system
  // and has no PDF.
  if (invoiceResult.data.type !== 'Other') {
    return { ok: false, err: 'pdf-not-found' }
  }

  return sendMiscellaneousInvoiceEmail(invoiceResult.data)
}

/** The status and public reason the send route answers with for a failure. */
export const toSendInvoiceEmailError = (
  failure: SendInvoiceEmailFailure
): { status: number; reason: economy.SendInvoiceEmailErrorCode } => {
  switch (failure) {
    case 'invoice-not-found':
      return { status: 404, reason: 'invoice-not-found' }
    case 'pdf-not-found':
      return { status: 404, reason: 'pdf-not-found' }
    case 'no-lease-id':
    case 'lease-not-found':
    case 'no-contact-code':
    case 'contact-not-found':
    case 'protected-identity':
      return { status: 422, reason: 'no-recipient' }
    case 'no-email':
      return { status: 422, reason: 'no-email' }
    case 'missing-expiration-date':
      return { status: 422, reason: 'missing-due-date' }
    case 'send-failed':
      return { status: 500, reason: 'send-failed' }
    case 'invoice-unknown':
    case 'pdf-unknown':
    case 'contact-unknown':
      return { status: 500, reason: 'unknown' }
  }
}

/*
 * The error strings POST /invoices/notify-batch has always reported, kept so
 * its callers see no change.
 */
export const toNotifyBatchError = (
  failure: SendInvoiceEmailFailure
): string => {
  switch (failure) {
    case 'invoice-not-found':
    case 'contact-not-found':
      return 'not-found'
    case 'invoice-unknown':
    case 'contact-unknown':
    case 'send-failed':
      return 'unknown'
    default:
      return failure
  }
}
