import config from '../../../../common/config'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

//todo: move to global config or handle error statuses in middleware
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status < 500 // override Axios throwing errors so that we can handle errors manually
}

export type TenfastRequestOptions = {
  /** When false, omit Content-Type so axios can set multipart boundaries. */
  contentType?: string | false
}

export const createHeaders = (
  options: TenfastRequestOptions = {}
): Record<string, string> => {
  const headers: Record<string, string> = {
    'api-token': config.tenfast.apiKey,
  }

  const contentType =
    options.contentType === undefined ? 'application/json' : options.contentType
  if (contentType !== false) {
    headers['Content-type'] = contentType
  }

  return headers
}

/**
 * Without a bound, a Tenfast call that is accepted but never answered holds
 * the caller for as long as the OS allows; for the sync jobs that is for ever.
 */
const DEFAULT_TIMEOUT_MS = 30_000

export const request = async <T = any>(
  config: AxiosRequestConfig<any>,
  options?: TenfastRequestOptions
): Promise<AxiosResponse<T, any>> => {
  config.headers = {
    ...createHeaders(options),
    ...config.headers,
  }
  config.timeout ??= DEFAULT_TIMEOUT_MS

  return await axios(config)
}
