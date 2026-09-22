import DOMPurify from 'dompurify'

// Allowlist for guide step bodies. Keep in sync with sanitize.ts in
// services/communication (src/services/guides-service/sanitize.ts); the
// backend is the authority, this only protects against stale cached data.
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

export const GUIDE_HTML_ALLOWED_ATTRIBUTES = ['href', 'target', 'rel']

export function sanitizeGuideHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: GUIDE_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: GUIDE_HTML_ALLOWED_ATTRIBUTES,
  })
}
