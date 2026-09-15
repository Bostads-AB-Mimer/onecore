import config from '../../../../common/config'
import axios, { AxiosRequestConfig, AxiosResponse, isAxiosError } from 'axios'

//todo: move to global config or handle error statuses in middleware
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status < 500 // override Axios throwing errors so that we can handle errors manually
}

const createHeaders = () => {
  const headers = {
    'Content-type': 'application/json',
    'api-token': config.tenfast.apiKey,
  }

  return headers
}

export const request = async <T = any>(
  config: AxiosRequestConfig<any>
): Promise<AxiosResponse<T, any>> => {
  config.headers = createHeaders()

  try {
    return await axios(config)
  } catch (err) {
    // Axios attaches the outgoing request headers (including the plaintext
    // api-token) and the raw request/response sockets directly onto the
    // thrown error. Several catch blocks in tenfast-adapter.ts log that
    // error as-is, which would otherwise ship the token and megabytes of
    // socket internals to stdout and Elasticsearch. Strip them here, once,
    // before the error can reach a logger.
    if (isAxiosError(err)) {
      delete err.request
      if (err.response) delete (err.response as { request?: unknown }).request
      if (err.config?.headers) delete err.config.headers['api-token']
    }
    throw err
  }
}
