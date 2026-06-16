import { loggedAxios as axios } from '@onecore/utilities'
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
