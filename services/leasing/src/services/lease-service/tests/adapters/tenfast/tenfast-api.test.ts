jest.mock('axios', () => {
  const axios = Object.assign(jest.fn(), { defaults: {} })
  return { __esModule: true, default: axios }
})

import axios from 'axios'
import { request } from '../../../adapters/tenfast/tenfast-api'

const axiosMock = axios as unknown as jest.Mock

describe('tenfast-api.request', () => {
  beforeEach(() => {
    axiosMock.mockReset()
    axiosMock.mockResolvedValue({ status: 200, data: {} })
  })

  it('bounds every call so a hung Tenfast fails within a minute', async () => {
    await request({ method: 'get', url: 'https://tenfast.test/v1/avtal' })

    const config = axiosMock.mock.calls[0][0]
    expect(config.timeout).toBeGreaterThan(0)
    expect(config.timeout).toBeLessThanOrEqual(60_000)
  })

  it('keeps a timeout the caller set', async () => {
    await request({
      method: 'get',
      url: 'https://tenfast.test/v1/avtal',
      timeout: 120_000,
    })

    expect(axiosMock.mock.calls[0][0].timeout).toBe(120_000)
  })
})
