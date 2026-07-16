import { loggedAxios as axios } from '@onecore/utilities'

import config from '../../common/config'
import { AdapterResult } from '../types'

// Error mapping shared by both scheduled-dispatch operations:
// 'not-found' -> unknown dispatch id
// 'conflict'  -> Infobip already sent/started the bulk; nothing was changed
// 400s forward the upstream code so the client can distinguish
// NOT_SCHEDULED from sendAt validation failures (SEND_AT_IN_PAST,
// SEND_AT_TOO_FAR_AHEAD, SEND_AT_TOO_SOON).
type ScheduleError = 'not-found' | 'conflict' | 'error' | string

const mapError = (
  err: unknown
): { ok: false; err: ScheduleError; statusCode: number } => {
  if (axios.isAxiosError(err) && err.response) {
    const status = err.response.status
    if (status === 404) return { ok: false, err: 'not-found', statusCode: 404 }
    if (status === 400) {
      const upstream = (err.response.data as { error?: string } | undefined)
        ?.error
      return { ok: false, err: upstream ?? 'NOT_SCHEDULED', statusCode: 400 }
    }
    if (status === 409) return { ok: false, err: 'conflict', statusCode: 409 }
    return { ok: false, err: 'error', statusCode: status }
  }
  return { ok: false, err: 'error', statusCode: 500 }
}

export const cancelDispatch = async (
  id: string
): Promise<
  AdapterResult<
    { dispatchId: string; cancelledRecipients: number },
    ScheduleError
  >
> => {
  try {
    const result = await axios.post(
      `${config.communicationService.url}/communication-log/dispatches/${encodeURIComponent(id)}/cancel`
    )
    return { ok: true, data: result.data }
  } catch (err) {
    return mapError(err)
  }
}

export const rescheduleDispatch = async (
  id: string,
  sendAt: string
): Promise<
  AdapterResult<{ dispatchId: string; sendAt: string }, ScheduleError>
> => {
  try {
    const result = await axios.post(
      `${config.communicationService.url}/communication-log/dispatches/${encodeURIComponent(id)}/reschedule`,
      { sendAt }
    )
    return { ok: true, data: result.data }
  } catch (err) {
    return mapError(err)
  }
}
