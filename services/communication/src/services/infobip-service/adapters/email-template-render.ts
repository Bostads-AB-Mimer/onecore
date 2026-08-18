// fetch is stable in Node.js 20 LTS but eslint-plugin-n still flags it as experimental
/* eslint-disable n/no-unsupported-features/node-builtins */
import config from '../../../common/config'
import { logger } from '@onecore/utilities'
import type {
  NonScoredParkingSpaceApprovedEmail,
  ParkingSpaceOfferEmail,
} from '@onecore/types'

import {
  dateFormatter,
  formatToSwedishCurrency,
  getParkingSpaceImageUrl,
} from './parking-space-formatting'

// Reconstructs a sent parking-space email as plaintext for the communication
// log: fetch the template (Infobip only merges at send time), rebuild the same
// placeholders, and substitute. The send path is untouched.

// Infobip email template (GET /email/1/templates/{id}); {{tokens}} unmerged.
export type EmailTemplate = { subject: string | null; html: string }

// Fetches a template for the log only. Returns null on any failure (never
// throws) so it can't fail a send that already went out.
export const getEmailTemplate = async (
  templateId: number
): Promise<EmailTemplate | null> => {
  try {
    const baseUrl = config.infobip.baseUrl.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/email/1/templates/${templateId}`, {
      headers: {
        Authorization: `App ${config.infobip.apiKey}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      logger.warn(
        { templateId, status: response.status },
        'Could not fetch Infobip email template for communication log'
      )
      return null
    }

    const json = (await response.json()) as { subject?: string; html?: string }
    return { subject: json.subject ?? null, html: json.html ?? '' }
  } catch (error) {
    logger.warn(
      { err: error, templateId },
      'Error fetching Infobip email template for communication log'
    )
    return null
  }
}

// Any parking-space email shape; the builder reads whatever fields are present.
// Derived from the @onecore/types payloads (offer carries firstName/deadlineDate/
// offerURL, non-scored carries leaseId) so a field rename surfaces here.
type ParkingSpaceEmailLike = Partial<
  Pick<
    ParkingSpaceOfferEmail & NonScoredParkingSpaceApprovedEmail,
    | 'address'
    | 'firstName'
    | 'availableFrom'
    | 'deadlineDate'
    | 'rent'
    | 'type'
    | 'parkingSpaceId'
    | 'objectId'
    | 'offerURL'
    | 'leaseId'
  >
>

// Rebuilds the sent placeholders (same formatting as the send path). Superset of
// all templates' tokens; the renderer ignores ones a given template doesn't use.
export const buildParkingSpacePlaceholders = (
  email: ParkingSpaceEmailLike
): Record<string, string> => {
  const placeholders: Record<string, string> = {}
  const set = (key: string, value: string | undefined) => {
    if (value !== undefined) placeholders[key] = value
  }

  set('address', email.address)
  set('firstName', email.firstName)
  set('type', email.type)
  set('parkingSpaceId', email.parkingSpaceId)
  set('objectId', email.objectId)
  set('offerURL', email.offerURL)
  set('leaseId', email.leaseId)
  if (email.availableFrom !== undefined) {
    set('availableFrom', dateFormatter.format(new Date(email.availableFrom)))
  }
  if (email.deadlineDate !== undefined) {
    set('deadlineDate', dateFormatter.format(new Date(email.deadlineDate)))
  }
  if (email.rent !== undefined) {
    set('rent', formatToSwedishCurrency(email.rent))
  }
  if (email.parkingSpaceId !== undefined) {
    set('parkingSpaceImage', getParkingSpaceImageUrl(email.parkingSpaceId))
  }

  return placeholders
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")

// Best-effort HTML → plaintext; {{tokens}} pass through for merging.
export const htmlToText = (html: string): string =>
  decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, '')
      // Keep link targets that live only in the href (e.g. the offer link):
      // "<a href="x">text</a>" → "text (x)". Skip mailto:/tel:, self-URL links,
      // and Infobip {$...} system placeholders (e.g. {$unsubscribe}) we never
      // resolve — for those the visible text alone is enough.
      .replace(
        /<a\b[^>]*?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_m, href: string, text: string) =>
          /^\s*(mailto:|tel:)/i.test(href) ||
          /\{\$/.test(href) ||
          text.trim() === href.trim()
            ? text
            : `${text} (${href})`
      )
      .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
      // Cells share a line; separate them so "label" and "value" don't merge.
      .replace(/<\/(td|th)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g

// Substitutes {{token}}; unknown token → empty, malformed {$x} left as-is.
export const fillTokens = (
  text: string,
  placeholders: Record<string, string>
): string =>
  text.replace(TOKEN_RE, (_match, key: string) =>
    key in placeholders ? placeholders[key] : ''
  )

// Merges rebuilt placeholders into a fetched template → plaintext. Returns null
// on any failure (never throws) so it can't fail a send that already went out;
// the route then falls back to the static label.
export const renderTemplate = (
  template: EmailTemplate,
  email: ParkingSpaceEmailLike
): { subject: string; body: string } | null => {
  try {
    const placeholders = buildParkingSpacePlaceholders(email)
    return {
      subject: fillTokens(template.subject ?? '', placeholders),
      body: fillTokens(htmlToText(template.html), placeholders),
    }
  } catch (error) {
    logger.warn(
      { err: error },
      'Failed to render Infobip email template for communication log'
    )
    return null
  }
}
