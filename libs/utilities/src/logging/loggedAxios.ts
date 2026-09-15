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

const REDACTED_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'ocp-apim-subscription-key',
  'cookie',
  'set-cookie',
])

// Catches credential headers not in the explicit list (x-auth-token, x-functions-key...).
const REDACTED_HEADER_PATTERN = /auth|token|secret|key|cookie/i

const isCredentialHeader = (name: string) =>
  REDACTED_HEADERS.has(name.toLowerCase()) || REDACTED_HEADER_PATTERN.test(name)

// Credentials must never reach logs. Exported for tests and for callers that
// log headers outside the axios interceptors (e.g. SOAP clients).
export const redactHeaders = (
  headers: Record<string, unknown> | undefined
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(headers ?? {})) {
    result[name] = isCredentialHeader(name) ? '[REDACTED]' : value
  }
  return result
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
