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
    headers: request.headers,
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
    headers: response.headers,
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
