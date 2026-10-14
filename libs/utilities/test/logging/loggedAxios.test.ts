import { AxiosHeaders } from 'axios'

import loggedAxios, { redactHeaders } from '../../src/logging/loggedAxios'
import { logger } from '../../src/logging/logger'

describe(redactHeaders, () => {
  it('redacts credential headers whatever their case, and keeps the rest', () => {
    expect(
      redactHeaders({
        'api-token': 'tenfast-key',
        Authorization: 'Bearer abc',
        'X-Api-Key': 'key',
        Cookie: 'session=1',
        'Content-Type': 'application/json',
        'x-correlation-id': 'c1',
      })
    ).toEqual({
      'api-token': '[REDACTED]',
      Authorization: '[REDACTED]',
      'X-Api-Key': '[REDACTED]',
      Cookie: '[REDACTED]',
      'Content-Type': 'application/json',
      'x-correlation-id': 'c1',
    })
  })

  it('handles the AxiosHeaders instances axios hands interceptors', () => {
    const headers = new AxiosHeaders({
      'api-token': 'tenfast-key',
      'set-cookie': ['session=1'],
      accept: 'application/json',
    })

    expect(redactHeaders(headers)).toEqual({
      'api-token': '[REDACTED]',
      'set-cookie': '[REDACTED]',
      accept: 'application/json',
    })
  })

  it('does not change the headers the request is sent with', () => {
    const headers = { 'api-token': 'tenfast-key' }

    redactHeaders(headers)

    expect(headers['api-token']).toBe('tenfast-key')
  })

  it('gives an empty object for missing headers', () => {
    expect(redactHeaders(undefined)).toEqual({})
  })
})

describe('loggedAxios', () => {
  it('logs requests and responses without credential values', async () => {
    const info = jest.spyOn(logger, 'info').mockImplementation(() => undefined)

    await loggedAxios.get('https://tenfast.example/v1/hyresobjekt', {
      headers: { 'api-token': 'tenfast-key' },
      adapter: async (config) => ({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: { 'set-cookie': 'session=1' },
        config,
      }),
    })

    const logged = JSON.stringify(info.mock.calls)
    expect(logged).not.toContain('tenfast-key')
    expect(logged).not.toContain('session=1')
    expect(logged).toContain('[REDACTED]')
    info.mockRestore()
  })
})
