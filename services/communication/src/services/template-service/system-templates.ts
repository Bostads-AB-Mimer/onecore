import { fillPlaceholders, Placeholders, renderMarkdown } from './render/render'
import { EmailFooter, wrapInLayout } from './render/layout'

// Templates the code sends by key (template.systemKey). Ids differ between
// environments, so code never refers to a system template by id.
export const SYSTEM_TEMPLATE_KEYS = [
  'parking_space_offer_additional',
  'parking_space_offer_replace',
  'parking_space_accept_offer',
  'non_scored_parking_space_approved',
  'non_scored_parking_space_denied',
  'work_order',
  'work_order_external_contractor',
  'invoice_notification',
  'inspection_protocol',
  'lease_termination_confirmation',
] as const

export type SystemTemplateKey = (typeof SYSTEM_TEMPLATE_KEYS)[number]

export const SYSTEM_TEMPLATE_FOOTER: Record<SystemTemplateKey, EmailFooter> = {
  parking_space_offer_additional: 'contact',
  parking_space_offer_replace: 'contact',
  parking_space_accept_offer: 'contact',
  non_scored_parking_space_approved: 'contact',
  non_scored_parking_space_denied: 'contact',
  work_order: 'contact',
  work_order_external_contractor: 'contact',
  invoice_notification: 'payment',
  inspection_protocol: 'payment',
  lease_termination_confirmation: 'none',
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
  const { html, text } = wrapInLayout(
    body,
    SYSTEM_TEMPLATE_FOOTER[template.systemKey]
  )
  return {
    subject: fillPlaceholders(template.subject, placeholders),
    html,
    text,
    bodyText: body.text,
  }
}
