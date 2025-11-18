import config from '../../../../common/config'
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'

//todo: move to global config or handle error statuses in middleware
axios.defaults.validateStatus = function (status) {
  return status >= 200 && status < 500 // override Axios throwing errors so that we can handle errors manually
}

const tenfastBaseUrl = config.tenfast.baseUrl

let accessToken: string | undefined = undefined

const getAccessToken = async () => {
  const username = config.tenfast.username
  const password = config.tenfast.password

  const requestConfig = {
    method: 'get',
    url: `${tenfastBaseUrl}/v1/auth`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      username: username,
      password: password,
    },
  }

  const result = await axios(requestConfig)
  return result.data.token
}

const createHeaders = (accessToken: string) => {
  const headers = {
    'Content-type': 'application/json',
    'api-token': accessToken,
  }

  return headers
}

//Exported for testing purposes only
export const request = async <T = any>(
  config: AxiosRequestConfig<any>
): Promise<AxiosResponse<T, any>> => {
  if (!accessToken) {
    accessToken = await getAccessToken()
  }

  try {
    config.headers = createHeaders(accessToken ?? '')

    return await axios(config)
  } catch (error) {
    const axiosErr = error as AxiosError
    if (axiosErr.response?.status === 401) {
      accessToken = await getAccessToken()
      return await request(config)
    }

    throw error
  }
}
