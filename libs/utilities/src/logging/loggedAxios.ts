import axios from 'axios'
import logger from './logger'

const instance = axios.create()

instance.interceptors.request.use((request) => {
  const requestFields = {
    url: request.url,
    headers: request.headers,
    method: request.method,
  }

  logger.info(
    requestFields,
    `Outgoing request: ${request.method?.toUpperCase()} ${request.url}`
  )
  return request
})

instance.interceptors.response.use((response) => {
  const responseFields = {
    status: response.status,
    headers: response.headers,
    url: response.config.url,
  }
  logger.info(
    responseFields,
    `Outgoing response: ${response.config.method?.toUpperCase()} ${response.config.url} ${response.status}`
  )
  return response
})

export default instance
