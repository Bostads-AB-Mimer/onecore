import {
  contactsTokenToJson,
  readCodeVerifierFromBody,
  readJsonBodyRecord,
  readRefreshTokenFromBody,
} from '../contacts-auth-dto'

describe('contacts-auth-dto', () => {
  it('maps Keycloak token fields to camelCase JSON', () => {
    expect(
      contactsTokenToJson({
        access_token: 'a',
        refresh_token: 'r',
        expires_in: 60,
        refresh_expires_in: 3600,
        token_type: 'Bearer',
      })
    ).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 60,
      refreshExpiresIn: 3600,
      tokenType: 'Bearer',
    })
  })

  it('reads refreshToken and legacy refresh_token', () => {
    expect(readRefreshTokenFromBody({ refreshToken: 'x' })).toBe('x')
    expect(readRefreshTokenFromBody({ refresh_token: 'y' })).toBe('y')
    expect(readRefreshTokenFromBody({})).toBeUndefined()
    expect(readRefreshTokenFromBody(null)).toBeUndefined()
  })

  it('reads codeVerifier and legacy code_verifier', () => {
    expect(readCodeVerifierFromBody({ codeVerifier: 'v' })).toBe('v')
    expect(readCodeVerifierFromBody({ code_verifier: 'w' })).toBe('w')
    expect(readCodeVerifierFromBody(null)).toBeUndefined()
  })

  it('normalizes non-object JSON bodies to an empty record', () => {
    expect(readJsonBodyRecord(null)).toEqual({})
    expect(readJsonBodyRecord([])).toEqual({})
  })
})
