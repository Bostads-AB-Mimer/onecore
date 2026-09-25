// sanitize-html is pinned to 2.17.5 in package.json: 2.17.6+ pulls in an
// ESM-only htmlparser2 that neither jest nor the CommonJS build can load.
import sanitizeHtml from 'sanitize-html'
import { guides } from '@onecore/types'

// Allowlist for guide step bodies. Keep in sync with the DOMPurify config in
// apps/property-tree (src/shared/lib/sanitizeHtml.ts).
export const GUIDE_HTML_ALLOWED_TAGS = [
  'p',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'br',
]

// Link targets a guide may contain: http(s), mailto, same-page fragments or
// queries, and root-relative paths to other ONECore pages. Keep in sync with
// GUIDE_HTML_ALLOWED_URI_REGEXP in apps/property-tree
// (src/shared/lib/sanitizeHtml.ts).
// - Bare relative paths ("lagenheter/123") are refused: they resolve against
//   whichever page renders the guide rather than the app root.
// - Browsers normalise backslashes to forward slashes, so "\\evil.com" and
//   "/\evil.com" navigate like the protocol-relative "//evil.com". Hence a
//   leading "/" must not be followed by either slash.
// Case-insensitive so "HTTPS://" passes too.
const GUIDE_HREF_PATTERN = /^(?:https?:|mailto:|[#?]|\/(?![/\\]))/i

// Browsers ignore leading whitespace in a href, hence the trim.
export const isAllowedGuideHref = (href: string): boolean =>
  GUIDE_HREF_PATTERN.test(href.trimStart())

const options: sanitizeHtml.IOptions = {
  allowedTags: GUIDE_HTML_ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  // Defence in depth: the transform below already drops every href that
  // does not match GUIDE_HREF_PATTERN.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const transformed: sanitizeHtml.Attributes = {
        ...attribs,
        rel: 'noopener noreferrer',
      }
      if (
        transformed.href !== undefined &&
        !isAllowedGuideHref(transformed.href)
      ) {
        delete transformed.href
      }
      return { tagName, attribs: transformed }
    },
  },
}

export const sanitizeGuideHtml = (html: string): string =>
  sanitizeHtml(html, options)

/** Sanitize every step body in a guide write before it reaches the database. */
export const sanitizeGuideWrite = <T extends { steps: guides.StepInput[] }>(
  input: T
): T => ({
  ...input,
  steps: input.steps.map((step) => ({
    ...step,
    body: sanitizeGuideHtml(step.body),
  })),
})
