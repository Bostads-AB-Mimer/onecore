import { AxiosHeaders } from 'axios'

import { redactHeaders } from '../../src/logging/loggedAxios'

describe(redactHeaders, () => {
  it('replaces credential headers regardless of casing', () => {
    const result = redactHeaders({
      Authorization: 'token secret',
      'Proxy-Authorization': 'Basic secret',
      'x-api-key': 'secret',
      'Ocp-Apim-Subscription-Key': 'secret',
      Cookie: 'session=secret',
      'Content-Type': 'application/json',
    })

    expect(result).toEqual({
      Authorization: '[REDACTED]',
      'Proxy-Authorization': '[REDACTED]',
      'x-api-key': '[REDACTED]',
      'Ocp-Apim-Subscription-Key': '[REDACTED]',
      Cookie: '[REDACTED]',
      'Content-Type': 'application/json',
    })
  })

  it('redacts unlisted headers whose name looks like a credential', () => {
    const result = redactHeaders({
      'X-Auth-Token': 'secret',
      'x-functions-key': 'secret',
      'X-Client-Secret': 'secret',
      Signature: 'secret',
      'x-session-id': 'secret',
      'x-jwt-assertion': 'secret',
      'X-Password': 'secret',
      'x-credential': 'secret',
      Accept: 'application/json',
      'Content-Length': '12',
    })

    expect(result).toEqual({
      'X-Auth-Token': '[REDACTED]',
      'x-functions-key': '[REDACTED]',
      'X-Client-Secret': '[REDACTED]',
      Signature: '[REDACTED]',
      'x-session-id': '[REDACTED]',
      'x-jwt-assertion': '[REDACTED]',
      'X-Password': '[REDACTED]',
      'x-credential': '[REDACTED]',
      Accept: 'application/json',
      'Content-Length': '12',
    })
  })

  it('handles an AxiosHeaders instance like the interceptors receive', () => {
    const headers = new AxiosHeaders({
      Authorization: 'token secret',
      Accept: 'application/json',
    })

    expect(redactHeaders(headers)).toEqual({
      Authorization: '[REDACTED]',
      Accept: 'application/json',
    })
  })

  it('does not mutate the original headers', () => {
    const headers = { authorization: 'token secret' }

    redactHeaders(headers)

    expect(headers.authorization).toBe('token secret')
  })

  it('handles missing headers', () => {
    expect(redactHeaders(undefined)).toEqual({})
  })
})
