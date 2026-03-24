import config from '../../../../common/config'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

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

  return await axios(config)
}
