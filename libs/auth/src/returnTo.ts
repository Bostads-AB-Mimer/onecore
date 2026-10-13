/**
 * Reduces a path to one on this origin, falling back to `/`.
 *
 * Parsing with `URL` instead of matching on the string catches what browsers
 * normalise away before navigating: `/\evil.example` and `/\t/evil.example`
 * both resolve to another origin, though neither starts with `//`.
 */
export function safeReturnTo(
  path: string | null | undefined,
  origin: string = window.location.origin
): string {
  if (!path?.startsWith('/')) return '/'

  let url: URL
  try {
    url = new URL(path, origin)
  } catch {
    return '/'
  }
  if (url.origin !== origin) return '/'

  return `${url.pathname}${url.search}${url.hash}`
}
