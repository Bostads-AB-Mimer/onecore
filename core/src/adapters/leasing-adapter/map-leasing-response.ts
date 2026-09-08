import { AxiosResponse } from 'axios'

import { AdapterResult } from '../types'

// Maps a leasing HTTP response to an AdapterResult:
//   2xx                      -> ok, with `pick(body)` as data
//   a status listed in errors -> that error code
//   anything else            -> 'request-failed'
//
// Relies on axios.defaults.validateStatus being set process-wide in
// leasing-adapter/index.ts (status < 500 resolves instead of throwing), so
// callers must be imported via the leasing-adapter folder index for that
// side effect to run. Network errors and 5xx still throw and are handled by
// the caller's try/catch.
export const mapLeasingResponse = <B, T, E extends string>(
  response: AxiosResponse<B>,
  errors: Record<number, E>,
  pick: (body: B) => T
): AdapterResult<T, E | 'request-failed'> => {
  if (response.status >= 200 && response.status < 300) {
    return { ok: true, data: pick(response.data) }
  }

  const err = errors[response.status]
  return { ok: false, err: err ?? 'request-failed' }
}
