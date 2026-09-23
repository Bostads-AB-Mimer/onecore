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

// Same schemes the backend allows (http, https, mailto) plus relative links
// to other ONECore pages; everything else, javascript: and data: included,
// loses the href. The `/(?!/)` rules out protocol-relative URLs such as
// //evil.example, which would otherwise pass as a relative link.
// Case-insensitive so "HTTPS://" survives too.
export const GUIDE_HTML_ALLOWED_URI_REGEXP =
  /^(?:https?:|mailto:|[#?]|\/(?!\/))/i

export function sanitizeGuideHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: GUIDE_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: GUIDE_HTML_ALLOWED_ATTRIBUTES,
    ALLOWED_URI_REGEXP: GUIDE_HTML_ALLOWED_URI_REGEXP,
    // Only href carries a URI; without this, the narrow regexp above would
    // also reject plain values such as rel="noopener" and target="_blank".
    ADD_URI_SAFE_ATTR: ['rel', 'target'],
  })
}
