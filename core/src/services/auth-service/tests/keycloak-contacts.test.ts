import axios from 'axios'
import nock from 'nock'

jest.mock('../../../common/config', () => ({
  __esModule: true,
  default: {
    auth: {
      keycloak: {
        url: 'http://keycloak.test',
        contacts: {
          realm: 'mimer-contacts',
          clientId: 'mina-sidor',
          clientSecret: 'client-secret',
        },
      },
    },
  },
}))

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

import {
  exchangeContactsAuthorizationCode,
  logoutContactsSession,
  refreshContactsAccessToken,
  resetContactsKeycloakClientForTests,
} from '../keycloak-contacts'

const tokenPath = '/realms/mimer-contacts/protocol/openid-connect/token'
const logoutPath = '/realms/mimer-contacts/protocol/openid-connect/logout'

function requestBodyText(body: unknown): string {
  if (typeof body === 'string') {
    return body
  }
  if (Buffer.isBuffer(body)) {
    return body.toString('utf8')
  }
  return ''
}

describe('keycloak-contacts', () => {
  beforeEach(() => {
    resetContactsKeycloakClientForTests()
    nock.cleanAll()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('refreshContactsAccessToken', () => {
    it('returns tokens for each refresh token when refreshed concurrently', async () => {
      nock('http://keycloak.test')
        .post(tokenPath)
        .times(2)
        .reply(200, (_uri, body) => {
          const text = requestBodyText(body)
          if (text.includes('refresh-a')) {
            return {
              access_token: 'access-a',
              refresh_token: 'refresh-a-new',
              expires_in: 300,
              token_type: 'Bearer',
            }
          }
          if (text.includes('refresh-b')) {
            return {
              access_token: 'access-b',
              refresh_token: 'refresh-b-new',
              expires_in: 300,
              token_type: 'Bearer',
            }
          }
          return [500, { error: 'unexpected_body' }]
        })

      const [resultA, resultB] = await Promise.all([
        refreshContactsAccessToken('refresh-a'),
        refreshContactsAccessToken('refresh-b'),
      ])

      expect(resultA.access_token).toBe('access-a')
      expect(resultB.access_token).toBe('access-b')
      expect(nock.isDone()).toBe(true)
    })
  })

  describe('exchangeContactsAuthorizationCode', () => {
    it('returns token fields without verifying JWT', async () => {
      nock('http://keycloak.test').post(tokenPath).reply(200, {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 300,
        refresh_expires_in: 1800,
        token_type: 'Bearer',
      })

      const result = await exchangeContactsAuthorizationCode(
        'auth-code',
        'https://mina-sidor/callback'
      )

      expect(result).toEqual({
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 300,
        refresh_expires_in: 1800,
        token_type: 'Bearer',
      })
      expect(nock.isDone()).toBe(true)
    })

    it('includes code_verifier in the token request when provided', async () => {
      nock('http://keycloak.test')
        .post(tokenPath)
        .reply(200, (_uri, body) => {
          const text = requestBodyText(body)
          expect(text).toContain('code_verifier=pkce-secret')
          return {
            access_token: 'access',
            expires_in: 300,
            token_type: 'Bearer',
          }
        })

      await exchangeContactsAuthorizationCode(
        'auth-code',
        'https://mina-sidor/callback',
        'pkce-secret'
      )

      expect(nock.isDone()).toBe(true)
    })

    it('propagates invalid_grant from Keycloak', async () => {
      nock('http://keycloak.test')
        .post(tokenPath)
        .reply(400, { error: 'invalid_grant' })

      await expect(
        exchangeContactsAuthorizationCode('bad', 'https://example/cb')
      ).rejects.toMatchObject({
        response: { status: 400, data: { error: 'invalid_grant' } },
      })
    })

    it('rejects invalid_grant when axios defaults accept 4xx', async () => {
      nock('http://keycloak.test')
        .post(tokenPath)
        .reply(400, { error: 'invalid_grant' })

      const original = axios.defaults.validateStatus
      axios.defaults.validateStatus = (status) => status >= 200 && status < 500

      try {
        await expect(
          exchangeContactsAuthorizationCode('bad', 'https://example/cb')
        ).rejects.toMatchObject({
          response: { status: 400, data: { error: 'invalid_grant' } },
        })
      } finally {
        axios.defaults.validateStatus = original
      }
    })
  })

  describe('logoutContactsSession', () => {
    it('posts the refresh token and client credentials to the logout endpoint', async () => {
      nock('http://keycloak.test')
        .post(logoutPath)
        .reply(204, (_uri, body) => {
          const text = requestBodyText(body)
          expect(text).toContain('refresh_token=rt')
          expect(text).toContain('client_id=mina-sidor')
          expect(text).toContain('client_secret=client-secret')
          return ''
        })

      await logoutContactsSession('rt')

      expect(nock.isDone()).toBe(true)
    })

    it('rejects invalid_grant when axios defaults accept 4xx', async () => {
      nock('http://keycloak.test')
        .post(logoutPath)
        .reply(400, { error: 'invalid_grant' })

      const original = axios.defaults.validateStatus
      axios.defaults.validateStatus = (status) => status >= 200 && status < 500

      try {
        await expect(logoutContactsSession('gone')).rejects.toMatchObject({
          response: { status: 400, data: { error: 'invalid_grant' } },
        })
      } finally {
        axios.defaults.validateStatus = original
      }
    })
  })
})
