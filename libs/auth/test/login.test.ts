import type { AuthConfig } from '../src'
import { buildLoginUrl, prepareLogin, takePendingLogin } from '../src/login'

const config: AuthConfig = {
  keycloakUrl: 'https://auth.example',
  keycloakRealm: 'onecore',
  clientId: 'leasing',
  redirectUri: 'https://app.example/callback',
  coreUrl: 'https://core.example',
}

beforeEach(() => sessionStorage.clear())

describe('buildLoginUrl', () => {
  it('points at the realm auth endpoint with the code flow parameters', () => {
    const url = new URL(buildLoginUrl(config, 'nonce-1'))

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://auth.example/realms/onecore/protocol/openid-connect/auth'
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'leasing',
      redirect_uri: 'https://app.example/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'nonce-1',
    })
  })

  it('ignores a realm path already present in keycloakUrl', () => {
    const url = new URL(
      buildLoginUrl(
        { ...config, keycloakUrl: 'https://auth.example/realms/onecore-test' },
        'n'
      )
    )

    expect(url.pathname).toBe('/realms/onecore/protocol/openid-connect/auth')
  })
})

describe('prepareLogin', () => {
  it('sends only a nonce as state and keeps the return path in sessionStorage', () => {
    const url = new URL(prepareLogin(config, '/uthyrning/bostad?tab=2'))
    const state = url.searchParams.get('state')

    expect(state).toMatch(/^[0-9a-f]{32}$/)
    expect(takePendingLogin()).toEqual({
      nonce: state,
      returnTo: '/uthyrning/bostad?tab=2',
    })
  })

  it('uses a new nonce for every login', () => {
    const first = new URL(prepareLogin(config, '/')).searchParams.get('state')
    const second = new URL(prepareLogin(config, '/')).searchParams.get('state')

    expect(first).not.toBe(second)
  })

  it('stores / instead of a return path that leaves the origin', () => {
    prepareLogin(config, '/\\evil.example')

    expect(takePendingLogin()?.returnTo).toBe('/')
  })
})

describe('takePendingLogin', () => {
  it('can only be taken once', () => {
    prepareLogin(config, '/')

    expect(takePendingLogin()).not.toBeNull()
    expect(takePendingLogin()).toBeNull()
  })

  it('treats malformed storage as no pending login', () => {
    sessionStorage.setItem('onecore-auth:pending-login', '{not json')
    expect(takePendingLogin()).toBeNull()

    sessionStorage.setItem('onecore-auth:pending-login', '{"nonce":1}')
    expect(takePendingLogin()).toBeNull()
  })
})
