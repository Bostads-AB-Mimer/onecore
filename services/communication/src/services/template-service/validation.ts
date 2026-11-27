import { communication } from '@onecore/types'

import {
  fillPlaceholders,
  findTokens,
  inspectMarkdown,
  InvalidPlaceholderUrlError,
  MissingPlaceholderError,
  Placeholders,
  renderMarkdown,
} from './render/render'
import type { PlaceholderDef } from './system-templates'

export type TemplateValidationCode =
  | 'UNKNOWN_PLACEHOLDER'
  | 'MISSING_REQUIRED_PLACEHOLDER'
  | 'PLACEHOLDER_NOT_ALONE'
  | 'INVALID_URL'
  | 'MISSING_PLACEHOLDER'
  | 'INVALID_PLACEHOLDER_URL'
  | 'SMS_TEXT_TOO_LONG'

// A template that would fail or go out broken at send time; the routes
// answer 400 with `code`, and nothing is saved.
export class TemplateValidationError extends Error {
  constructor(
    readonly code: TemplateValidationCode,
    readonly details: string[] = []
  ) {
    super(`Invalid template: ${code} ${details.join(', ')}`.trim())
    this.name = 'TemplateValidationError'
  }
}

export type TemplateRules = {
  placeholders: readonly PlaceholderDef[]
  examples: Placeholders // values for the test render
  smsTextLimit?: number // set when the template is sent as SMS
}

// Rep templates are sent as SMS and have no placeholders yet (MIM-2289).
export const REP_TEMPLATE_RULES: TemplateRules = {
  placeholders: [],
  examples: {},
  smsTextLimit: communication.SMS_TEXT_MAX_LENGTH,
}

const LINK_PROTOCOL = /^(https:|mailto:|tel:)/i
const IMAGE_PROTOCOL = /^https:/i

const unique = (values: string[]) => [...new Set(values)]

/**
 * Checks a template the way a send would use it, then test-renders it with
 * the example values. Throws TemplateValidationError; returns the body's
 * plain text (the SMS text) on success.
 */
export const validateTemplate = (
  template: { subject: string | null; body: string },
  rules: TemplateRules
): { text: string } => {
  const subjectTokens = template.subject ? findTokens(template.subject) : []
  const bodyTokens = findTokens(template.body)
  const known = new Set(rules.placeholders.map((p) => p.token))

  const unknown = unique([...subjectTokens, ...bodyTokens]).filter(
    (token) => !known.has(token)
  )
  if (unknown.length > 0) {
    throw new TemplateValidationError('UNKNOWN_PLACEHOLDER', unknown)
  }

  const missingRequired = rules.placeholders
    .filter((p) => p.required && !bodyTokens.includes(p.token))
    .map((p) => p.token)
  if (missingRequired.length > 0) {
    throw new TemplateValidationError(
      'MISSING_REQUIRED_PLACEHOLDER',
      missingRequired
    )
  }

  // Sender HTML only goes in as HTML when alone in its paragraph; anywhere
  // else (or in the subject) it would arrive as flattened text.
  const { urls, aloneCounts } = inspectMarkdown(template.body)
  const notAlone = rules.placeholders
    .filter((p) => p.kind === 'block')
    .map((p) => p.token)
    .filter(
      (token) =>
        subjectTokens.includes(token) ||
        bodyTokens.filter((t) => t === token).length !==
          (aloneCounts.get(token) ?? 0)
    )
  if (notAlone.length > 0) {
    throw new TemplateValidationError('PLACEHOLDER_NOT_ALONE', notAlone)
  }

  // The renderer only checks addresses that hold a placeholder; the test
  // render below covers those, this covers the ones typed in directly.
  const badUrls = urls
    .filter(({ kind, href }) => {
      if (href.includes('{{')) return false
      const allowed = kind === 'image' ? IMAGE_PROTOCOL : LINK_PROTOCOL
      return !allowed.test(href.trim())
    })
    .map(({ href }) => href)
  if (badUrls.length > 0) {
    throw new TemplateValidationError('INVALID_URL', unique(badUrls))
  }

  let text: string
  try {
    text = renderMarkdown(template.body, rules.examples).text
    if (template.subject) fillPlaceholders(template.subject, rules.examples)
  } catch (err: unknown) {
    if (err instanceof MissingPlaceholderError) {
      throw new TemplateValidationError('MISSING_PLACEHOLDER', err.tokens)
    }
    if (err instanceof InvalidPlaceholderUrlError) {
      throw new TemplateValidationError('INVALID_PLACEHOLDER_URL', [err.token])
    }
    throw err
  }

  if (rules.smsTextLimit !== undefined && text.length > rules.smsTextLimit) {
    throw new TemplateValidationError('SMS_TEXT_TOO_LONG', [
      String(text.length),
    ])
  }
  return { text }
}
