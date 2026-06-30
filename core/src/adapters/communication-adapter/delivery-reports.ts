import { loggedAxios as axios, logger } from '@onecore/utilities'

import config from '../../common/config'
import { AdapterResult } from '../types'

/**
 * Forward an Infobip email delivery report to the communication service for
 * processing. Core authenticates the external webhook via Keycloak (role
 * `infobip-webhook`); this is the trusted internal hop to communication's
 * unauthenticated /delivery-report endpoint, where the status mapping + DB
 * update live.
 */
export const forwardDeliveryReport = async (
  report: unknown
): Promise<AdapterResult<undefined, 'error'>> => {
  try {
    await axios.post(
      `${config.communicationService.url}/delivery-report`,
      report,
      { headers: { 'Content-Type': 'application/json' } }
    )
    return { ok: true, data: undefined }
  } catch (err) {
    logger.error({ err }, 'communication-adapter.forwardDeliveryReport')
    if (axios.isAxiosError(err) && err.response) {
      return { ok: false, err: 'error', statusCode: err.response.status }
    }
    return { ok: false, err: 'error', statusCode: 500 }
  }
}
