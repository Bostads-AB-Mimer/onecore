import { AxiosResponse } from 'axios'

import { AdapterResult } from '../types'

// Maps a leasing HTTP response to an AdapterResult:
//   successStatus            -> ok, with `pick(body)` as data
//   a status listed in errors -> that error code
//   anything else            -> 'request-failed'
//
// successStatus is the exact status leasing answers with on success (201
// for create, 200 otherwise), so any other 2xx is treated as unexpected.
//
// Relies on axios.defaults.validateStatus being set process-wide in
// leasing-adapter/index.ts (status < 500 resolves instead of throwing), so
// callers must be imported via the leasing-adapter folder index for that
// side effect to run. Network errors and 5xx still throw and are handled by
// the caller's try/catch.
export const mapLeasingResponse = <B, T, E extends string>(
  response: AxiosResponse<B>,
  successStatus: number,
  errors: Record<number, E>,
  pick: (body: B) => T
): AdapterResult<T, E | 'request-failed'> => {
  if (response.status === successStatus) {
    return { ok: true, data: pick(response.data) }
  }

  const err = errors[response.status]
  return { ok: false, err: err ?? 'request-failed' }
}
