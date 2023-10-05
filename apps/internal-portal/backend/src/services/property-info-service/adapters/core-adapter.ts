import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import Config from '../../../common/config'

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

const getFromCore = async (
  config: AxiosRequestConfig<any>
): Promise<AxiosResponse<any, any>> => {
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

const getMaterialChoiceStatuses = async (projectCode: string) => {
  const materialChoiceStatusResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/rentalproperties/material-choice-statuses?projectCode=${projectCode}&includeRentalProperties=false`,
  })

  return materialChoiceStatusResponse.data
}

const getCommittedChoices = async (apartmentId: string) => {
  const committedChoicesResponse = await getFromCore({
    method: 'get',
    url: `${coreBaseUrl}/rentalproperties/${apartmentId}/material-choices`,
  })

  return committedChoicesResponse.data
}

export { getMaterialChoiceStatuses, getCommittedChoices }
