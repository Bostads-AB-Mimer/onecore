import config from '@src/common/config'
import axios, { AxiosError, AxiosResponse } from 'axios'
import {
  StralforsAccessTokenResponse,
  StralforsGetChannelLookupResponse,
  StralforsPostChannelLookupResponse,
} from './schema'

let accessToken: string | null = null

async function getAccessToken(): Promise<string> {
  const response = await axios.post(
    `${config.stralfors.baseUrl}/v1/oidc/authorization`,
    {
      grant_type: 'client_credentials',
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${config.stralfors.clientId}:${config.stralfors.clientSecret}`)}`,
      },
    }
  )

  return StralforsAccessTokenResponse.parse(response.data).access_token
}

async function makeStralforsRequest(
  url: string,
  {
    method = 'GET',
    data,
    headers,
  }: {
    method?: string
    data?: any
    headers?: any
  },
  retryCount: number = 0
): Promise<
  { data: AxiosResponse; error: null } | { data: null; error: AxiosError }
> {
  if (!accessToken) {
    accessToken = await getAccessToken()
  }

  try {
    const response = await axios({
      url,
      method,
      data,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...headers,
      },
    })

    return { data: response.data, error: null }
  } catch (err: any) {
    if (err.status === 401) {
      if (retryCount > 1) {
        throw new Error('Could not get valid access token')
      }

      accessToken = await getAccessToken()

      return makeStralforsRequest(
        url,
        { method, data, headers },
        retryCount + 1
      )
    }

    return { data: null, error: err as AxiosError }
  }
}

export async function postChannelLookup(nationalIdentityNumbers: string[]) {
  const response = await makeStralforsRequest(
    `${config.stralfors.baseUrl}/rest/outputmanagement/channellookup/v1/lookup`,
    {
      method: 'POST',
      data: {
        channels: ['Kivra', 'Billo', 'eInvoiceB2C'],
        candidates: nationalIdentityNumbers,
      },
    }
  )

  if (response.error) {
    throw new Error()
  }

  return StralforsPostChannelLookupResponse.parse(response.data).correlationId
}

export async function getChannelLookup(correlationId: string) {
  const response = await makeStralforsRequest(
    `${config.stralfors.baseUrl}/rest/outputmanagement/channellookup/v1/lookup/${correlationId}`,
    {
      method: 'GET',
    }
  )

  if (response.error?.status === 404) {
    return null
  }

  return StralforsGetChannelLookupResponse.parse(response.data).results
}
