import { randomUUID } from 'node:crypto'

import config from '../../../common/config'
import {
  Email,
  ParkingSpaceOfferEmail,
  WorkOrderEmail,
  ParkingSpaceAcceptOfferEmail,
  NonScoredParkingSpaceApprovedEmail,
  NonScoredParkingSpaceDeniedEmail,
  InvoiceNotificationEmail,
  InspectionProtocolEmail,
  LeaseTerminationConfirmationEmail,
} from '@onecore/types'
import { logger } from '@onecore/utilities'

import { EmailAttachment } from '@onecore/types'
import { getSystemTemplate } from '../../template-service/adapters/db'
import {
  RenderedEmail,
  renderEmail,
  SystemTemplateKey,
} from '../../template-service/system-templates'
import {
  InvalidPlaceholderValueError,
  type Placeholders,
} from '../../template-service/render/render'
import { TrustedHtml } from '../../template-service/render/trusted-html'
import { EmailV4Message, EmailV4Response } from './types'
import { ProviderResponseError } from './provider-error'
import {
  dateFormatter,
  formatToSwedishCurrency,
  getParkingSpaceImageUrl,
} from './parking-space-formatting'
import { buildLeaseTerminationPlaceholders } from './lease-termination-placeholders'

// Response from POSTing to Infobip's /email/4/messages (outbound email send).
// Order of `messages` matches the destinations array passed in.
export type InfobipSendEmailResponse = EmailV4Response

// A system email that went out: the provider's answer plus exactly what was
// sent, which the routes write to the communication log.
export type SentEmail = { response: EmailV4Response; rendered: RenderedEmail }

/** Sender identity, e.g. "Bostads AB Mimer <noreply@mimer.nu>". */
export const emailSender = () =>
  `${config.organisation.name} <${config.organisation.noReplyEmail}>`

// TODO: set applicationId on each message (env public hostname, e.g.
// epic-mim-1838.dev.mimer.nu / api.mimer.nu) and filter each Infobip
// delivery-report subscription to its own application, so environments
// only receive reports for their own sends (stops cross-env PII fan-out).
// `signal` lets the scheduled-sends worker bound the call.
const sendEmailV4 = async (
  messages: EmailV4Message[],
  signal?: AbortSignal
): Promise<EmailV4Response> => {
  const baseUrl = config.infobip.baseUrl.replace(/\/$/, '') // Remove trailing slash
  const url = `${baseUrl}/email/4/messages`
  const apiKey = config.infobip.apiKey

  logger.info(
    { url, messageCount: messages.length },
    'Sending email via v4 API'
  )

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new ProviderResponseError('infobip-email', response.status, errorBody)
  }

  return response.json() as Promise<EmailV4Response>
}

// Uses /email/3/send (multipart) for emails with attachments. Constructs the
// multipart body manually to avoid undici adding ;charset=UTF-8 to the
// Content-Type boundary, which Infobip rejects.
const sendEmailWithAttachments = async (params: {
  to: string
  rendered: RenderedEmail
  attachments: EmailAttachment[]
}): Promise<void> => {
  const baseUrl = config.infobip.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/email/3/send`
  const apiKey = config.infobip.apiKey
  const crlf = '\r\n'
  // Random, so no rendered value can guess it and open a new form part.
  const boundary = `----InfobipBoundary${randomUUID()}`
  const enc = new TextEncoder()

  const formFields: Record<string, string> = {
    from: emailSender(),
    to: params.to,
    subject: params.rendered.subject,
    html: params.rendered.html,
    text: params.rendered.text,
  }

  const parts: Uint8Array[] = []

  for (const [name, value] of Object.entries(formFields)) {
    parts.push(
      enc.encode(
        `--${boundary}${crlf}` +
          `Content-Disposition: form-data; name="${name}"${crlf}${crlf}` +
          `${value}${crlf}`
      )
    )
  }

  for (const att of params.attachments) {
    parts.push(
      enc.encode(
        `--${boundary}${crlf}` +
          `Content-Disposition: form-data; name="attachment"; filename="${att.filename}"${crlf}` +
          `Content-Type: ${att.contentType}${crlf}${crlf}`
      )
    )
    const binary = atob(att.content)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    parts.push(bytes)
    parts.push(enc.encode(crlf))
  }

  parts.push(enc.encode(`--${boundary}--${crlf}`))

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
  const body = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    body.set(part, offset)
    offset += part.length
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new ProviderResponseError('infobip-email', response.status, errorBody)
  }
}

// Loads and renders before anything is sent: a missing template, a missing
// placeholder or a bad URL value throws here and no email goes out.
const renderSystemEmail = async (
  key: SystemTemplateKey,
  placeholders: Placeholders
): Promise<RenderedEmail> =>
  renderEmail(await getSystemTemplate(key), placeholders)

/** Sends already-rendered content (also used by the template preview script). */
export const sendRenderedEmail = (
  to: string,
  rendered: RenderedEmail
): Promise<EmailV4Response> =>
  sendEmailV4([
    {
      sender: emailSender(),
      destinations: [{ to: [{ destination: to }] }],
      content: {
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
    },
  ])

const sendSystemEmail = async (
  to: string,
  key: SystemTemplateKey,
  placeholders: Placeholders
): Promise<SentEmail> => {
  const rendered = await renderSystemEmail(key, placeholders)
  const response = await sendRenderedEmail(to, rendered)
  return { response, rendered }
}

// Building runs before anything is sent, so a failure there (e.g. an
// unparseable date) is invalid send data, not an unknown send outcome.
const placeholdersFrom = <T>(
  build: (email: T) => Placeholders,
  email: T
): Placeholders => {
  try {
    return build(email)
  } catch (err: unknown) {
    throw new InvalidPlaceholderValueError({ cause: err })
  }
}

export const buildParkingSpaceOfferPlaceholders = (
  email: ParkingSpaceOfferEmail
): Record<string, string> => ({
  address: email.address,
  firstName: email.firstName,
  availableFrom: dateFormatter.format(new Date(email.availableFrom)),
  deadlineDate: dateFormatter.format(new Date(email.deadlineDate)),
  rent: formatToSwedishCurrency(email.rent),
  type: email.type,
  parkingSpaceId: email.parkingSpaceId,
  objectId: email.objectId,
  offerURL: email.offerURL,
  parkingSpaceImage: getParkingSpaceImageUrl(email.parkingSpaceId),
})

export const buildAcceptOfferPlaceholders = (
  email: ParkingSpaceAcceptOfferEmail
): Record<string, string> => ({
  firstName: email.firstName,
  address: email.address,
  availableFrom: dateFormatter.format(new Date(email.availableFrom)),
  parkingSpaceId: email.parkingSpaceId,
  objectId: email.objectId,
  type: email.type,
  rent: formatToSwedishCurrency(email.rent),
  parkingSpaceImage: getParkingSpaceImageUrl(email.parkingSpaceId),
})

export const buildNonScoredApprovedPlaceholders = (
  email: NonScoredParkingSpaceApprovedEmail
): Record<string, string> => ({
  leaseId: email.leaseId,
  address: email.address,
  availableFrom: dateFormatter.format(new Date(email.availableFrom)),
  parkingSpaceId: email.parkingSpaceId,
  objectId: email.objectId,
  type: email.type,
  rent: formatToSwedishCurrency(email.rent),
  parkingSpaceImage: getParkingSpaceImageUrl(email.parkingSpaceId),
})

export const buildNonScoredDeniedPlaceholders = (
  email: NonScoredParkingSpaceDeniedEmail
): Record<string, string> => ({
  address: email.address,
  availableFrom: dateFormatter.format(new Date(email.availableFrom)),
  parkingSpaceId: email.parkingSpaceId,
  objectId: email.objectId,
  type: email.type,
  rent: formatToSwedishCurrency(email.rent),
})

export const buildWorkOrderPlaceholders = (
  email: WorkOrderEmail
): Placeholders => ({
  // Odoo sends HTML (contractors write it too): kept as HTML, but sanitized.
  message: TrustedHtml.fromUntrusted(email.text),
  ...(email.externalContractorName && {
    externalContractor: email.externalContractorName,
  }),
})

export const buildInvoiceNotificationPlaceholders = (
  email: InvoiceNotificationEmail
): Record<string, string> => ({
  firstName: email.firstName,
  address: email.address,
  invoiceNumber: email.invoiceNumber,
  dueDate: dateFormatter.format(new Date(email.dueDate)),
  totalAmount: formatToSwedishCurrency(email.totalAmount),
})

export const buildInspectionProtocolPlaceholders = (
  email: InspectionProtocolEmail
): Record<string, string> => ({ firstName: email.firstName })

export const sendEmail = async (message: Email) => {
  logger.info({ subject: message.subject }, 'Sending email')

  try {
    const response = await sendEmailV4([
      {
        sender: emailSender(),
        destinations: [{ to: [{ destination: message.to }] }],
        content: { subject: message.subject, text: message.text },
      },
    ])

    logger.info({ subject: message.subject }, 'Sending email complete')
    return response
  } catch (error) {
    logger.error({ err: error }, 'email-adapter.sendEmail')
    throw error
  }
}

export const sendParkingSpaceOffer = async (
  email: ParkingSpaceOfferEmail
): Promise<SentEmail> => {
  logger.info({ baseUrl: config.infobip.baseUrl }, 'Sending template email')
  try {
    return await sendSystemEmail(
      email.to,
      email.applicationType === 'Replace'
        ? 'parking_space_offer_replace'
        : 'parking_space_offer_additional',
      placeholdersFrom(buildParkingSpaceOfferPlaceholders, email)
    )
  } catch (error) {
    logger.error({ err: error }, 'email-adapter.sendParkingSpaceOffer')
    throw error
  }
}

export const sendParkingSpaceAcceptOffer = async (
  email: ParkingSpaceAcceptOfferEmail
): Promise<SentEmail> => {
  logger.info(
    { baseUrl: config.infobip.baseUrl },
    'Sending Parking Space Accept Offer Email'
  )
  try {
    return await sendSystemEmail(
      email.to,
      'parking_space_accept_offer',
      placeholdersFrom(buildAcceptOfferPlaceholders, email)
    )
  } catch (error) {
    logger.error({ err: error }, 'email-adapter.sendParkingSpaceAcceptOffer')
    throw error
  }
}

export const sendNonScoredParkingSpaceApproved = async (
  email: NonScoredParkingSpaceApprovedEmail
): Promise<SentEmail> => {
  logger.info(
    { baseUrl: config.infobip.baseUrl },
    'Sending Non-Scored Parking Space Approved Email'
  )
  try {
    return await sendSystemEmail(
      email.to,
      'non_scored_parking_space_approved',
      placeholdersFrom(buildNonScoredApprovedPlaceholders, email)
    )
  } catch (error) {
    logger.error(
      { err: error },
      'email-adapter.sendNonScoredParkingSpaceApproved'
    )
    throw error
  }
}

export const sendNonScoredParkingSpaceDenied = async (
  email: NonScoredParkingSpaceDeniedEmail
): Promise<SentEmail> => {
  logger.info(
    { baseUrl: config.infobip.baseUrl },
    'Sending Non-Scored Parking Space Denied Email'
  )
  try {
    return await sendSystemEmail(
      email.to,
      'non_scored_parking_space_denied',
      placeholdersFrom(buildNonScoredDeniedPlaceholders, email)
    )
  } catch (error) {
    logger.error(
      { err: error },
      'email-adapter.sendNonScoredParkingSpaceDenied'
    )
    throw error
  }
}

export const sendWorkOrderEmail = async (
  email: WorkOrderEmail
): Promise<SentEmail> => {
  logger.info({ baseUrl: config.infobip.baseUrl }, 'Sending work order email')
  try {
    return await sendSystemEmail(
      email.to,
      email.externalContractorName
        ? 'work_order_external_contractor'
        : 'work_order',
      placeholdersFrom(buildWorkOrderPlaceholders, email)
    )
  } catch (error) {
    logger.error({ err: error }, 'email-adapter.sendWorkOrderEmail')
    throw error
  }
}

export const sendBulkEmail = async (email: {
  emails: string[]
  subject: string
  text: string
  signal?: AbortSignal
}) => {
  logger.info(
    {
      recipientCount: email.emails.length,
      baseUrl: config.infobip.baseUrl,
    },
    'Sending bulk email'
  )

  try {
    const response = await sendEmailV4(
      [
        {
          sender: emailSender(),
          destinations: email.emails.map((addr) => ({
            to: [{ destination: addr }],
          })),
          content: { subject: email.subject, text: email.text },
        },
      ],
      email.signal
    )

    logger.info(
      { recipientCount: email.emails.length },
      'Bulk email submitted to Infobip'
    )
    return response
  } catch (error) {
    logger.error({ err: error }, 'email-adapter.sendBulkEmail')
    throw error
  }
}

// Sends via multipart when there are attachments; that endpoint returns no
// message ids, so `response` is null then.
const sendSystemEmailWithOptionalAttachments = async (
  to: string,
  key: SystemTemplateKey,
  placeholders: Placeholders,
  attachments: EmailAttachment[] | undefined
): Promise<{ response: EmailV4Response | null; rendered: RenderedEmail }> => {
  if (!attachments || attachments.length === 0) {
    return sendSystemEmail(to, key, placeholders)
  }
  const rendered = await renderSystemEmail(key, placeholders)
  await sendEmailWithAttachments({ to, rendered, attachments })
  return { response: null, rendered }
}

export const sendInvoiceNotificationEmail = async (
  email: InvoiceNotificationEmail
) => {
  logger.info(
    { baseUrl: config.infobip.baseUrl },
    'Sending invoice notification email'
  )
  try {
    return await sendSystemEmailWithOptionalAttachments(
      email.to,
      'invoice_notification',
      placeholdersFrom(buildInvoiceNotificationPlaceholders, email),
      email.attachments
    )
  } catch (error) {
    logger.error({ err: error }, 'email-adapter.sendInvoiceNotificationEmail')
    throw error
  }
}

export const sendInspectionProtocolEmail = async (
  email: InspectionProtocolEmail
) => {
  logger.info({ to: email.to }, 'Sending inspection protocol email')
  try {
    return await sendSystemEmailWithOptionalAttachments(
      email.to,
      'inspection_protocol',
      placeholdersFrom(buildInspectionProtocolPlaceholders, email),
      email.attachments
    )
  } catch (error) {
    logger.error({ err: error }, 'email-adapter.sendInspectionProtocolEmail')
    throw error
  }
}

export const sendLeaseTerminationConfirmation = async (
  email: LeaseTerminationConfirmationEmail
): Promise<SentEmail> => {
  logger.info(
    { baseUrl: config.infobip.baseUrl, leaseId: email.leaseId },
    'Sending lease termination confirmation email'
  )
  try {
    return await sendSystemEmail(
      email.to,
      'lease_termination_confirmation',
      placeholdersFrom(buildLeaseTerminationPlaceholders, email)
    )
  } catch (error) {
    logger.error(
      { err: error },
      'email-adapter.sendLeaseTerminationConfirmation'
    )
    throw error
  }
}

export const healthCheck = async () => {
  const baseUrl = config.infobip.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/email/4/messages`
  const apiKey = config.infobip.apiKey

  // Send a minimal invalid request to verify API connectivity
  // We expect a 400 validation error, which proves the API is reachable
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: [] }),
  })

  // If we get 401/403, there's an auth problem
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Infobip authentication failed: ${response.status}`)
  }

  // If we get 400 (validation error), the API is reachable and working
  // If we get 200 (shouldn't happen with empty messages), that's also fine
  if (response.status !== 400 && response.status !== 200) {
    const errorBody = await response.text()
    throw new Error(
      `Infobip health check failed: ${response.status} - ${errorBody}`
    )
  }
}
