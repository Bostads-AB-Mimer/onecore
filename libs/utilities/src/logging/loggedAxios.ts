import axios from 'axios'
import { logger } from './logger'
import { storage } from './loggingStorage'

const getCorrelationId = (): string | undefined | null => {
  if (storage && storage.getStore()) {
    const correlationId = (storage.getStore() as { correlationId: string })
      .correlationId

    return correlationId
  }

  return null
}

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

let loggingExlusionFilters: RegExp[] | null = null

export const setExclusionFilters = (exlusionFilters: RegExp[]) => {
  loggingExlusionFilters = exlusionFilters
}

const isUrlExcluded = (url: string | undefined) => {
  if (loggingExlusionFilters) {
    const isExcluded = loggingExlusionFilters.some((exclusionFilter) => {
      if (url && exclusionFilter.test(url)) {
        return true
      } else {
        return false
      }
    })

    return isExcluded
  }

  return false
}

axios.interceptors.request.use((request) => {
  if (isUrlExcluded(request.url)) {
    return request
  }

  const correlationId = getCorrelationId()

  if (correlationId) {
    request.headers['x-correlation-id'] = correlationId
  }

  const requestFields = {
    url: request.url,
    headers: redactHeaders(request.headers),
    method: request.method,
    correlationId: request.headers['x-correlation-id'],
  }

  logger.info(
    requestFields,
    `HTTP request: ${request.method?.toUpperCase()} ${request.url}`
  )

  return request
})

axios.interceptors.response.use((response) => {
  if (isUrlExcluded(response.config.url)) {
    return response
  }

  const correlationId = getCorrelationId()

  const responseFields = {
    status: response.status,
    headers: redactHeaders(response.headers),
    url: response.config.url,
    correlationId,
  }
  logger.info(
    responseFields,
    `HTTP response: ${response.config.method?.toUpperCase()} ${
      response.config.url
    } ${response.status}`
  )
  return response
})

export default axios
