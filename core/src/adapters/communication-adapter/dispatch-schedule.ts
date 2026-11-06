import { loggedAxios as axios, logger } from '@onecore/utilities'
import { communication } from '@onecore/types'

import config from '../../common/config'
import { AdapterResult } from '../types'
import { client, CommonErr, fail, mapFetchError, ok } from './helpers'

// leasing-adapter sets a process-wide validateStatus (<500); 4xx must throw
// here so the catch blocks map them instead of returning ok: true.
const throwOnNon2xx = {
  validateStatus: (status: number) => status >= 200 && status < 300,
}

// Error mapping shared by both scheduled-dispatch operations:
// 'not-found' -> unknown dispatch id
// 'conflict'  -> the worker already claimed/sent the recipients; nothing changed
// 400s forward the upstream code (SCHEDULING_DISABLED, SEND_AT_IN_PAST,
// SEND_AT_TOO_FAR_AHEAD, SEND_AT_OFF_SLOT, SEND_AT_IN_BLOCKED_HOURS,
// SEND_AT_TOO_SOON); a 400 without a code falls back to the generic 'error'.
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
      return { ok: false, err: upstream ?? 'error', statusCode: 400 }
    }
    if (status === 409) return { ok: false, err: 'conflict', statusCode: 409 }
    return { ok: false, err: 'error', statusCode: status }
  }
  return { ok: false, err: 'error', statusCode: 500 }
}

export const cancelDispatch = async (
  id: string
): Promise<
  AdapterResult<communication.CancelDispatchResponse, ScheduleError>
> => {
  try {
    const result = await axios.post(
      `${config.communicationService.url}/communication-log/dispatches/${encodeURIComponent(id)}/cancel`,
      undefined,
      throwOnNon2xx
    )
    // Runtime guarantee at the service boundary: axios types the body as
    // `any`, so validate against the shared schema instead of asserting.
    return {
      ok: true,
      data: communication.CancelDispatchResponseSchema.parse(result.data),
    }
  } catch (err) {
    return mapError(err)
  }
}

// Scheduling rules the service enforces, so the frontend picker can offer
// only valid slots. `enabled: false` means the service rejects any sendAt.
export const getScheduleConfig = async (): Promise<
  AdapterResult<communication.ScheduleConfig, CommonErr>
> => {
  try {
    const { data, error, response } = await client.GET(
      '/communication-log/schedule-config'
    )
    if (error || !response.ok) return fail(mapFetchError(response))
    return ok(communication.ScheduleConfigSchema.parse(data))
  } catch (err) {
    logger.error(
      { err },
      'communication-adapter: GET /communication-log/schedule-config failed'
    )
    return fail('unknown')
  }
}

export const rescheduleDispatch = async (
  id: string,
  sendAt: string
): Promise<
  AdapterResult<communication.RescheduleDispatchResponse, ScheduleError>
> => {
  try {
    const result = await axios.post(
      `${config.communicationService.url}/communication-log/dispatches/${encodeURIComponent(id)}/reschedule`,
      { sendAt },
      throwOnNon2xx
    )
    return {
      ok: true,
      data: communication.RescheduleDispatchResponseSchema.parse(result.data),
    }
  } catch (err) {
    return mapError(err)
  }
}
