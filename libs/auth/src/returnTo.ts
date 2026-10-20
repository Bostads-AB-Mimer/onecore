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

  // Normalising dot segments can itself produce a protocol-relative path:
  // `/.//evil.example` has this origin but normalises to `//evil.example`.
  const result = `${url.pathname}${url.search}${url.hash}`
  return new URL(result, origin).origin === origin ? result : '/'
}
