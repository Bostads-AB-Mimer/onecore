import { loggedAxios as axios, PaginatedResponse } from '@onecore/utilities'
import { communication } from '@onecore/types'

import config from '../../common/config'
import { AdapterResult } from '../types'

export const getCustomerMessages = async (
  contactCode: string
): Promise<AdapterResult<communication.CustomerMessage[], 'error'>> => {
  try {
    const result = await axios.get(
      `${config.communicationService.url}/communication-log/customers/${encodeURIComponent(contactCode)}/messages`
    )
    return { ok: true, data: result.data }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return { ok: false, err: 'error', statusCode: err.response.status }
    }
    return { ok: false, err: 'error', statusCode: 500 }
  }
}

export const getDispatchById = async (
  id: string
): Promise<
  AdapterResult<communication.DispatchWithRecipients, 'error' | 'not-found'>
> => {
  try {
    const result = await axios.get(
      `${config.communicationService.url}/communication-log/dispatches/${encodeURIComponent(id)}`
    )
    return { ok: true, data: result.data }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      if (err.response.status === 404) {
        return { ok: false, err: 'not-found', statusCode: 404 }
      }
      return { ok: false, err: 'error', statusCode: err.response.status }
    }
    return { ok: false, err: 'error', statusCode: 500 }
  }
}

export const searchDispatches = async (
  query: Record<string, string | string[] | undefined>
): Promise<
  AdapterResult<PaginatedResponse<communication.DispatchListItem>, 'error'>
> => {
  try {
    const result = await axios.get(
      `${config.communicationService.url}/communication-log/dispatches`,
      // indexes: null serializes arrays as `channel=sms&channel=email`
      // (repeated keys) instead of axios' default `channel[]=...`, which the
      // service's query schema would not recognize.
      { params: query, paramsSerializer: { indexes: null } }
    )
    return { ok: true, data: result.data }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return { ok: false, err: 'error', statusCode: err.response.status }
    }
    return { ok: false, err: 'error', statusCode: 500 }
  }
}

export const getDispatchRecipients = async (
  id: string,
  query: Record<string, string | string[] | undefined>
): Promise<
  AdapterResult<
    PaginatedResponse<communication.MessageRecipient>,
    'error' | 'not-found'
  >
> => {
  try {
    const result = await axios.get(
      `${config.communicationService.url}/communication-log/dispatches/${encodeURIComponent(id)}/recipients`,
      { params: query, paramsSerializer: { indexes: null } }
    )
    return { ok: true, data: result.data }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      if (err.response.status === 404) {
        return { ok: false, err: 'not-found', statusCode: 404 }
      }
      return { ok: false, err: 'error', statusCode: err.response.status }
    }
    return { ok: false, err: 'error', statusCode: 500 }
  }
}
