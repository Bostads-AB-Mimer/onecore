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

// Link targets a guide may contain: http(s), mailto, same-page fragments or
// queries, and root-relative paths to other ONECore pages. Everything else,
// javascript:, data: and bare relative paths ("lagenheter/123") included,
// loses the href. Keep in sync with GUIDE_HREF_PATTERN in sanitize.ts in
// services/communication. The `/(?![/\\])` rules out protocol-relative URLs
// such as //evil.example, and /\evil.example, which browsers normalise to
// the same. Case-insensitive so "HTTPS://" survives too.
export const GUIDE_HTML_ALLOWED_URI_REGEXP =
  /^(?:https?:|mailto:|[#?]|\/(?![/\\]))/i

/**
 * True for a href the sanitizers keep. Leading whitespace is ignored, as by
 * browsers and both sanitizers.
 */
export const isAllowedGuideHref = (href: string): boolean =>
  GUIDE_HTML_ALLOWED_URI_REGEXP.test(href.trimStart())

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
