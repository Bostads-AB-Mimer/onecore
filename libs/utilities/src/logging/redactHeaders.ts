// Headers that carry credentials. Logs go to Elasticsearch, so these must
// never be written there: Tenfast's api-token, bearer and basic auth, API keys
// such as Azure API Management's Ocp-Apim-Subscription-Key, and session
// cookies. The pattern catches credential headers not listed by name.
const SECRET_HEADERS = new Set([
  'api-token',
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'ocp-apim-subscription-key',
  'cookie',
  'set-cookie',
])
const SECRET_HEADER_PATTERN =
  /auth|cookie|token|secret|passw|key|sign|credential|session|jwt/i

const isSecretHeader = (name: string) =>
  SECRET_HEADERS.has(name.toLowerCase()) || SECRET_HEADER_PATTERN.test(name)

/** A plain copy of the headers with credential values replaced, for logging. */
export const redactHeaders = (headers: unknown): Record<string, unknown> => {
  if (!headers || typeof headers !== 'object') return {}
  const plain =
    'toJSON' in headers && typeof headers.toJSON === 'function'
      ? (headers.toJSON() as Record<string, unknown>)
      : (headers as Record<string, unknown>)

  return Object.fromEntries(
    Object.entries(plain).map(([name, value]) => [
      name,
      isSecretHeader(name) ? '[REDACTED]' : value,
    ])
  )
}
