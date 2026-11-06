import { AxiosError, AxiosHeaders } from 'axios'

import {
  bodyForContactsKeycloakError,
  httpStatusForContactsKeycloakError,
} from '../contacts-keycloak-errors'

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Keycloak error')
  error.response = {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('contacts Keycloak error mapping', () => {
  it('maps invalid_grant to 400', () => {
    const error = axiosErrorWith(400, { error: 'invalid_grant' })
    expect(httpStatusForContactsKeycloakError(error)).toBe(400)
    expect(bodyForContactsKeycloakError(400)).toEqual({
      error: 'invalid_grant',
    })
  })

  it('maps client auth failure (401) to 502', () => {
    const error = axiosErrorWith(401, {
      error: 'unauthorized_client',
    })
    expect(httpStatusForContactsKeycloakError(error)).toBe(502)
    expect(bodyForContactsKeycloakError(502)).toEqual({
      error: 'keycloak_unavailable',
    })
  })

  it('maps network errors to 502', () => {
    expect(httpStatusForContactsKeycloakError(new Error('ECONNREFUSED'))).toBe(
      502
    )
  })

  it('maps 404 token endpoint to 502', () => {
    const error = axiosErrorWith(404, 'not found')
    expect(httpStatusForContactsKeycloakError(error)).toBe(502)
  })
})
