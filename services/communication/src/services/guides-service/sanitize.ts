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

// Browsers normalise backslashes to forward slashes, so a href starting with
// a backslash navigates like the protocol-relative "//evil.com" that
// allowProtocolRelative rejects. sanitize-html does not recognise it as one,
// so such hrefs are dropped below. Leading whitespace is ignored by browsers
// too, hence the trim.
const isBackslashHref = (href: string) => href.trimStart().startsWith('\\')

const options: sanitizeHtml.IOptions = {
  allowedTags: GUIDE_HTML_ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Relative links to other ONECore pages are allowed.
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const transformed: sanitizeHtml.Attributes = {
        ...attribs,
        rel: 'noopener noreferrer',
      }
      if (transformed.href && isBackslashHref(transformed.href)) {
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
