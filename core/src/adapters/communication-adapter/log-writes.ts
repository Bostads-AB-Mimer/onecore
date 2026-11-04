import { loggedAxios as axios } from '@onecore/utilities'
import { communication } from '@onecore/types'

import config from '../../common/config'
import { AdapterResult } from '../types'

/**
 * Write side of the communication log. Used for dispatches with no provider
 * send behind them — currently Mina sidor publications (MIM-1957), where the
 * "delivery" is the message existing in Odoo.
 *
 * axios rather than openapi-fetch (see CLAUDE.md) because the communication
 * service publishes no OpenAPI spec to generate a client from, and the rest of
 * this adapter — including log-reads.ts — is axios.
 */
export const logOutboundDispatch = async (
  params: communication.LogOutboundParams
): Promise<AdapterResult<{ dispatchId: string }, 'error'>> => {
  try {
    const result = await axios.post(
      `${config.communicationService.url}/communication-log/outbound`,
      params
    )
    return { ok: true, data: result.data }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return { ok: false, err: 'error', statusCode: err.response.status }
    }
    return { ok: false, err: 'error', statusCode: 500 }
  }
}
