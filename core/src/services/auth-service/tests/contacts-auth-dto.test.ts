import {
  contactsTokenToJson,
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
  })
})
