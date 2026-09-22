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

const options: sanitizeHtml.IOptions = {
  allowedTags: GUIDE_HTML_ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Relative links to other ONECore pages are allowed.
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
      },
    }),
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
