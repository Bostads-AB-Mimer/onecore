const BASE = 'https://keys-portal.invalid'

// Keycloak echoes `state` back untouched, so anyone can set it. Resolve it like the browser
// would (it reads '\' as '/' and drops tabs/newlines) and only keep paths on our own origin.
export function toReturnPath(state: string | null): string {
  if (!state?.startsWith('/')) return '/'
  let url: URL
  try {
    url = new URL(state, BASE)
  } catch {
    return '/'
  }
  if (url.origin !== BASE || url.pathname.startsWith('//')) return '/'
  return url.pathname + url.search + url.hash
}
