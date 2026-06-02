import axios, { AxiosError, AxiosResponse } from 'axios'
import config from '@src/common/config'
import {
  StralforsAccessTokenResponseSchema,
  StralforsGetChannelLookupResponseSchema,
  StralforsPostChannelLookupResponseSchema,
} from './schema'
import { logger } from '@onecore/utilities'

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

  return StralforsAccessTokenResponseSchema.parse(response.data).access_token
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

async function getChannelLookup(correlationId: string) {
  const response = await makeStralforsRequest(
    `${config.stralfors.baseUrl}/rest/outputmanagement/channellookup/v1/lookup/${correlationId}`,
    {
      method: 'GET',
    }
  )

  if (response.error?.status === 404) {
    return null
  }

  return (
    StralforsGetChannelLookupResponseSchema.parse(response.data).results ?? null
  )
}

export async function postChannelLookup(nationalIdentityNumbers: string[]) {
  const response = await makeStralforsRequest(
    `${config.stralfors.baseUrl}/rest/outputmanagement/channellookup/v1/lookup`,
    {
      method: 'POST',
      data: {
        channels: ['Kivra', 'eInvoiceB2C'],
        candidates: nationalIdentityNumbers.map(
          (n) => n.replaceAll(/[^0-9]/g, '') // Strålfors API accepts only numeric characters in national identity number
        ),
      },
    }
  )

  if (response.error) {
    logger.error(response.error, 'stralfors-adapter.postChannelLookup')
    throw response.error
  }

  const correlationId = StralforsPostChannelLookupResponseSchema.parse(
    response.data
  ).correlationId

  const pollGetChannelLookup = async (retryCount: number = 0) => {
    const result = await getChannelLookup(correlationId)

    if (!result) {
      if (retryCount >= config.stralfors.maxRetries) {
        throw new Error(
          `Failed to get a response from Strålfors API after ${config.stralfors.maxRetries} retries`
        )
      }

      await new Promise((resolve) =>
        setTimeout(resolve, config.stralfors.retryBackoffMs)
      )
      return pollGetChannelLookup(retryCount + 1)
    }

    return result
  }

  return pollGetChannelLookup()
}
