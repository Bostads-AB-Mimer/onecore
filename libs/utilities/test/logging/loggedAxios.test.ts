import { AxiosHeaders } from 'axios'

import loggedAxios from '../../src/logging/loggedAxios'
import { logger } from '../../src/logging/logger'

describe('axios logging interceptors', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('logs requests and responses without credential values', async () => {
    const info = jest.spyOn(logger, 'info').mockImplementation(() => undefined)
    let sentToken: unknown

    await loggedAxios.get('https://example.invalid/api', {
      headers: { 'api-token': 'secret-key' },
      adapter: async (config) => {
        sentToken = config.headers['api-token']
        return {
          data: [],
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders({ 'set-cookie': 'session=1' }),
          config,
        }
      },
    })

    const logged = JSON.stringify(info.mock.calls)
    expect(logged).toContain('HTTP request: GET')
    expect(logged).toContain('HTTP response: GET')
    expect(logged).not.toContain('secret-key')
    expect(logged).not.toContain('session=1')
    expect(sentToken).toBe('secret-key')
  })
})
