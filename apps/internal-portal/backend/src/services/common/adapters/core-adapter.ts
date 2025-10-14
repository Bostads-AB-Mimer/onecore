import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import Config from '../../../common/config'
import { Invoice } from '@onecore/types'

const coreBaseUrl = Config.core.url
const coreUsername = Config.core.username
const corePassword = Config.core.password
let accessToken: string | undefined = undefined

const getAccessToken = async () => {
  const config = {
    method: 'post',
    url: `${coreBaseUrl}/auth/generatetoken`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      username: coreUsername,
      password: corePassword,
    },
  }

  const result = await axios(config)

  return result.data.token
}

const createHeaders = (accessToken: string) => {
  const headers = {
    Authorization: 'Bearer ' + accessToken,
  }

  return headers
}

const getUnpaidInvoices = async (offset?: number, size?: number) => {
  const params = new URLSearchParams()
  if (offset !== undefined) {
    params.append('offset', offset.toString())
  }
  if (size !== undefined) {
    params.append('size', size.toString())
  }

  const url = `${coreBaseUrl}/invoices/unpaid?${params.toString()}`

  return getFromCore<{ content: Invoice[] }>({
    method: 'GET',
    url,
  })
}

const getFromCore = async <T = any>(
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
      return await getFromCore(config)
    }

    throw error
  }
}

export { getUnpaidInvoices, getFromCore }
