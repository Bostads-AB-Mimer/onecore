import he from 'he'
import sanitizeHtml from 'sanitize-html'
import striptags from 'striptags'

import { EMAIL_STYLES } from './styles'

// [^<>]* stops at the next "<", so a run of unclosed tags stays linear.
const HAS_TAG = /<\/?[a-z][^<>]*>/i
const KEPT_LINK = /^(https:|mailto:|tel:)/i
// Set by the sanitizer on a link it won't keep; written out as text below.
const DROPPED_HREF = 'data-dropped-href'
const DROPPED_LINK = /<a data-dropped-href="([^"]*)">([\s\S]*?)<\/a>/g
// The regexes below run only on sanitized output: every "<" opens a real tag
// and every <a> is closed, so none of them can backtrack across the input.
const LINK = /<a\b[^>]*?\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g

// Plain text has no links, so the address follows the text unless it is the text.
const linkAsText = (_m: string, href: string, inner: string) => {
  const label = he.decode(striptags(inner)).trim()
  const address = he.decode(href)
  return label === address || label === address.replace(/^(mailto|tel):/i, '')
    ? inner
    : `${inner} (${href})`
}

// Sanitized HTML → plain text: paragraphs apart, <br>, div lines and list
// items as lines, links as "text (url)". A raw newline is just whitespace.
const htmlToText = (html: string): string =>
  he
    .decode(
      striptags(
        html
          .replace(/\s+/g, ' ')
          .replace(LINK, linkAsText)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<li\b[^>]*>/gi, '- ')
          .replace(/<\/li>/gi, '\n')
      )
    )
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

// What an editor's rich text needs; anything else (scripts, styles, images,
// iframes, classes, event handlers) is dropped, and a link other than https,
// mailto or tel becomes text. Our inline styles replace the sender's.
const withStyle =
  (style: string) =>
  (tagName: string): sanitizeHtml.Tag => ({
    tagName,
    attribs: { style },
  })

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'div',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'ul',
    'ol',
    'li',
    'a',
  ],
  allowedAttributes: {
    a: ['href', 'style', DROPPED_HREF],
    p: ['style'],
    div: ['style'],
    ul: ['style'],
    ol: ['style'],
    li: ['style'],
  },
  allowedSchemes: ['https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  transformTags: {
    p: withStyle(EMAIL_STYLES.paragraph),
    div: withStyle(EMAIL_STYLES.line),
    ul: withStyle(EMAIL_STYLES.list),
    ol: withStyle(EMAIL_STYLES.list),
    li: withStyle(EMAIL_STYLES.listItem),
    a: (tagName, attribs): sanitizeHtml.Tag => {
      const href = attribs.href?.trim() ?? ''
      if (KEPT_LINK.test(href)) {
        return { tagName, attribs: { href, style: EMAIL_STYLES.link } }
      }
      return { tagName, attribs: href ? { [DROPPED_HREF]: href } : {} }
    },
  },
}

/**
 * Sender-written HTML (e.g. an Odoo work order message) cleaned to an
 * allowlist, so it can go into the email as HTML instead of being escaped.
 * Only fromUntrusted creates one, so a plain string never skips escaping.
 */
export class TrustedHtml {
  private constructor(
    readonly html: string,
    readonly text: string
  ) {}

  static fromUntrusted(raw: string): TrustedHtml {
    // Text without tags is plain text (older callers): escape, keep breaks.
    const source = HAS_TAG.test(raw)
      ? raw
      : he.escape(raw).replace(/\r?\n/g, '<br>')
    const clean = sanitizeHtml(source, SANITIZE_OPTIONS).replace(
      DROPPED_LINK,
      linkAsText
    )
    // One styled block around everything, so no text falls outside the
    // paragraph look. A div, since a <p> can't hold the sender's blocks.
    const html = `<div style="${EMAIL_STYLES.paragraph}">${clean}</div>`
    return new TrustedHtml(html, htmlToText(html))
  }
}
