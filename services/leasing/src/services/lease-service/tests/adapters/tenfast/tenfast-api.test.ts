jest.mock('axios', () => {
  const axios = Object.assign(jest.fn(), { defaults: {} })
  return { __esModule: true, default: axios }
})

import axios from 'axios'
import { Context } from 'koa'
import {
  boundTenfastCalls,
  request,
} from '../../../adapters/tenfast/tenfast-api'

const axiosMock = axios as unknown as jest.Mock

describe('tenfast-api.request', () => {
  beforeEach(() => {
    axiosMock.mockReset()
    axiosMock.mockResolvedValue({ status: 200, data: {} })
  })

  it('leaves a call outside a sync route unbounded', async () => {
    await request({ method: 'get', url: 'https://tenfast.test/v1/avtal' })

    expect(axiosMock.mock.calls[0][0].timeout).toBeUndefined()
  })

  it('bounds every call inside a sync route at 10s', async () => {
    await boundTenfastCalls({} as Context, () =>
      request({ method: 'get', url: 'https://tenfast.test/v1/avtal' })
    )

    expect(axiosMock.mock.calls[0][0].timeout).toBe(10_000)
  })

  it('keeps a timeout the caller set inside a sync route', async () => {
    await boundTenfastCalls({} as Context, () =>
      request({
        method: 'get',
        url: 'https://tenfast.test/v1/avtal',
        timeout: 60_000,
      })
    )

    expect(axiosMock.mock.calls[0][0].timeout).toBe(60_000)
  })
})
