import { communication } from '@onecore/types'

import { fillPlaceholders, Placeholders, renderMarkdown } from './render/render'
import { wrapInLayout } from './render/layout'

export const SYSTEM_TEMPLATE_KEYS = communication.SYSTEM_TEMPLATE_KEYS
export type SystemTemplateKey = communication.SystemTemplateKey

export type PlaceholderDef = {
  token: string
  label: string // Swedish name shown in the picker
  kind: communication.PlaceholderKind
  required?: boolean // the email is useless without it
}

const text = (token: string, label: string): PlaceholderDef => ({
  token,
  label,
  kind: 'text',
})
const url = (token: string, label: string): PlaceholderDef => ({
  token,
  label,
  kind: 'url',
})

const PARKING_SPACE: PlaceholderDef[] = [
  text('address', 'Adress'),
  text('availableFrom', 'Ledig från'),
  text('parkingSpaceId', 'Bilplatsnummer'),
  text('objectId', 'Objektsnummer'),
  text('type', 'Typ'),
  text('rent', 'Hyra'),
]
const OFFER: PlaceholderDef[] = [
  text('firstName', 'Förnamn'),
  ...PARKING_SPACE,
  text('deadlineDate', 'Sista svarsdag'),
  url('offerURL', 'Länk till erbjudandet'),
  url('parkingSpaceImage', 'Bild på bilplatsen'),
]
const WORK_ORDER_MESSAGE: PlaceholderDef = {
  token: 'message',
  label: 'Meddelandet i ärendet',
  kind: 'block',
  required: true,
}

/**
 * Placeholders each system email's send always supplies (a test keeps this
 * in step with the builders via the fixtures). Stopgap until MIM-2289.
 */
export const SYSTEM_TEMPLATE_PLACEHOLDERS: Record<
  SystemTemplateKey,
  readonly PlaceholderDef[]
> = {
  parking_space_offer_additional: OFFER,
  parking_space_offer_replace: OFFER,
  parking_space_accept_offer: [
    text('firstName', 'Förnamn'),
    ...PARKING_SPACE,
    url('parkingSpaceImage', 'Bild på bilplatsen'),
  ],
  non_scored_parking_space_approved: [
    text('leaseId', 'Kontraktsnummer'),
    ...PARKING_SPACE,
    url('parkingSpaceImage', 'Bild på bilplatsen'),
  ],
  non_scored_parking_space_denied: PARKING_SPACE,
  work_order: [WORK_ORDER_MESSAGE],
  work_order_external_contractor: [
    WORK_ORDER_MESSAGE,
    text('externalContractor', 'Entreprenör'),
  ],
  invoice_notification: [
    text('firstName', 'Förnamn'),
    text('address', 'Adress'),
    text('invoiceNumber', 'Fakturanummer'),
    text('dueDate', 'Förfallodatum'),
    text('totalAmount', 'Belopp'),
  ],
  inspection_protocol: [text('firstName', 'Förnamn')],
  lease_termination_confirmation: [
    text('firstName', 'Förnamn'),
    text('lastName', 'Efternamn'),
    text('leaseId', 'Kontraktsnummer'),
    text('endDate', 'Kontraktet upphör'),
    text('preferredMoveOutDate', 'Önskat avflyttningsdatum'),
    text('rentalObjectAddress', 'Objektets adress'),
    text('type', 'Objektstyp'),
    text('tenantNames', 'Hyresgäst(er)'),
  ],
}

export type SystemTemplate = {
  systemKey: SystemTemplateKey
  subject: string
  body: string // markdown
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
  bodyText: string // text without the footer, for the communication log
}

// The template read itself failed (DB down etc.); nothing was sent.
export class SystemTemplateLookupError extends Error {
  readonly code = 'SYSTEM_TEMPLATE_LOOKUP_FAILED'
  constructor(
    readonly systemKey: string,
    options?: { cause: unknown }
  ) {
    super(`System template lookup failed: ${systemKey}`, options)
    this.name = 'SystemTemplateLookupError'
  }
}

export class SystemTemplateNotFoundError extends Error {
  readonly code = 'SYSTEM_TEMPLATE_NOT_FOUND'
  constructor(readonly systemKey: string) {
    super(`System template not found: ${systemKey}`)
    this.name = 'SystemTemplateNotFoundError'
  }
}

/** Renders a system template into the finished email we hand the provider. */
export const renderEmail = (
  template: SystemTemplate,
  placeholders: Placeholders
): RenderedEmail => {
  const body = renderMarkdown(template.body, placeholders)
  const { html, text } = wrapInLayout(body)
  return {
    subject: fillPlaceholders(template.subject, placeholders),
    html,
    text,
    bodyText: body.text,
  }
}
