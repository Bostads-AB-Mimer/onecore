import { AxiosResponse } from 'axios'

import { mapLeasingResponse } from '../../leasing-adapter/map-leasing-response'

const response = <B>(status: number, data: B): AxiosResponse<B> =>
  ({ status, data }) as AxiosResponse<B>

describe(mapLeasingResponse, () => {
  it('picks the body on 2xx', () => {
    const result = mapLeasingResponse(
      response(200, { content: { id: 1 } }),
      { 404: 'not-found' },
      (body) => body.content
    )

    expect(result).toEqual({ ok: true, data: { id: 1 } })
  })

  it('treats every 2xx status as ok', () => {
    const result = mapLeasingResponse(
      response(201, { content: 'created' }),
      {},
      (body) => body.content
    )

    expect(result).toEqual({ ok: true, data: 'created' })
  })

  it('returns the mapped error code for a listed status', () => {
    const result = mapLeasingResponse(
      response(409, { error: 'exists' }),
      { 400: 'bad-request', 409: 'conflict' },
      (body) => body
    )

    expect(result).toEqual({ ok: false, err: 'conflict' })
  })

  it("returns 'request-failed' for an unlisted status", () => {
    const result = mapLeasingResponse(
      response(418, undefined),
      { 404: 'not-found' },
      () => undefined
    )

    expect(result).toEqual({ ok: false, err: 'request-failed' })
  })
})
