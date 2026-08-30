import { loggedAxios as axios, logger } from '@onecore/utilities'
import { communication } from '@onecore/types'

import config from '../../common/config'
import { AdapterResult } from '../types'

export const logCall = async (
  params: communication.LogCallParams
): Promise<AdapterResult<{ dispatchId: string }, 'bad-request' | 'error'>> => {
  try {
    const result = await axios.post(
      `${config.communicationService.url}/communication-log/calls`,
      params
    )
    return { ok: true, data: result.data }
  } catch (err) {
    logger.error({ err }, 'communication-adapter.logCall')
    if (axios.isAxiosError(err) && err.response) {
      if (err.response.status === 400) {
        return { ok: false, err: 'bad-request', statusCode: 400 }
      }
      return { ok: false, err: 'error', statusCode: err.response.status }
    }
    return { ok: false, err: 'error', statusCode: 500 }
  }
}
