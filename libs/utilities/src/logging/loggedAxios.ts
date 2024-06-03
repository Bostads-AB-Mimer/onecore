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

axios.interceptors.request.use((request) => {
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
