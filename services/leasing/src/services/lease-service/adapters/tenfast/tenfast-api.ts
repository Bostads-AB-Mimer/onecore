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

export const request = async <T = any>(
  config: AxiosRequestConfig<any>,
  options?: TenfastRequestOptions
): Promise<AxiosResponse<T, any>> => {
  config.headers = {
    ...createHeaders(options),
    ...config.headers,
  }

  return await axios(config)
}
