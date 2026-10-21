import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import request from 'supertest'
import { AxiosError, AxiosHeaders } from 'axios'

import { registerContactsAuthRoutes } from '../contacts-auth-routes'
import * as contactsKeycloak from '../keycloak-contacts'

jest.mock('../keycloak-contacts', () => ({
  isContactsKeycloakConfigured: jest.fn(),
  exchangeContactsAuthorizationCode: jest.fn(),
  refreshContactsAccessToken: jest.fn(),
  logoutContactsSession: jest.fn(),
}))

const mocked = contactsKeycloak as jest.Mocked<typeof contactsKeycloak>

function buildApp() {
  const app = new Koa()
  const router = new KoaRouter()
  app.use(bodyParser())
  registerContactsAuthRoutes(router)
  app.use(router.routes())
  return app
}

function keycloakAxiosError(status: number, data: unknown): AxiosError {
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

describe('contacts auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /auth/contacts/token', () => {
    it('returns 503 when contacts Keycloak is not configured', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(false)

      const res = await request(buildApp().callback())
        .post('/auth/contacts/token')
        .send({ code: 'abc', redirectUri: 'https://example/cb' })

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('contacts_keycloak_not_configured')
    })

    it('returns 400 when code is missing', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)

      const res = await request(buildApp().callback())
        .post('/auth/contacts/token')
        .send({ redirectUri: 'https://example/cb' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('missing_authorization_code')
    })

    it('returns tokens on success', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.exchangeContactsAuthorizationCode.mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 300,
        refresh_expires_in: 1800,
        token_type: 'Bearer',
      })

      const res = await request(buildApp().callback())
        .post('/auth/contacts/token')
        .send({
          code: 'auth-code',
          redirectUri: 'https://mina-sidor/callback',
        })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBe('access')
      expect(res.body.refreshExpiresIn).toBe(1800)
      expect(mocked.exchangeContactsAuthorizationCode).toHaveBeenCalledWith(
        'auth-code',
        'https://mina-sidor/callback',
        undefined
      )
    })

    it('forwards codeVerifier to Keycloak exchange when present', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.exchangeContactsAuthorizationCode.mockResolvedValue({
        access_token: 'access',
        expires_in: 300,
        token_type: 'Bearer',
      })

      await request(buildApp().callback()).post('/auth/contacts/token').send({
        code: 'auth-code',
        redirectUri: 'https://mina-sidor/callback',
        codeVerifier: 'pkce-verifier',
      })

      expect(mocked.exchangeContactsAuthorizationCode).toHaveBeenCalledWith(
        'auth-code',
        'https://mina-sidor/callback',
        'pkce-verifier'
      )
    })

    it('returns 400 invalid_grant when Keycloak rejects the code', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.exchangeContactsAuthorizationCode.mockRejectedValue(
        keycloakAxiosError(400, { error: 'invalid_grant' })
      )

      const res = await request(buildApp().callback())
        .post('/auth/contacts/token')
        .send({ code: 'bad', redirectUri: 'https://example/cb' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_grant')
    })

    it('returns 502 keycloak_unavailable when Keycloak returns 401', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.exchangeContactsAuthorizationCode.mockRejectedValue(
        keycloakAxiosError(401, { error: 'unauthorized_client' })
      )

      const res = await request(buildApp().callback())
        .post('/auth/contacts/token')
        .send({ code: 'x', redirectUri: 'https://example/cb' })

      expect(res.status).toBe(502)
      expect(res.body.error).toBe('keycloak_unavailable')
    })
  })

  describe('POST /auth/contacts/refresh', () => {
    it('returns 400 when refreshToken is missing', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)

      const res = await request(buildApp().callback())
        .post('/auth/contacts/refresh')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('missing_refresh_token')
    })

    it('returns new tokens on success', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.refreshContactsAccessToken.mockResolvedValue({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 300,
        token_type: 'Bearer',
      })

      const res = await request(buildApp().callback())
        .post('/auth/contacts/refresh')
        .send({ refreshToken: 'old-refresh' })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBe('new-access')
      expect(mocked.refreshContactsAccessToken).toHaveBeenCalledWith(
        'old-refresh'
      )
    })

    it('accepts legacy refresh_token in the body', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.refreshContactsAccessToken.mockResolvedValue({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 300,
        token_type: 'Bearer',
      })

      const res = await request(buildApp().callback())
        .post('/auth/contacts/refresh')
        .send({ refresh_token: 'legacy-refresh' })

      expect(res.status).toBe(200)
      expect(mocked.refreshContactsAccessToken).toHaveBeenCalledWith(
        'legacy-refresh'
      )
    })

    it('returns 502 when Keycloak is unreachable', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.refreshContactsAccessToken.mockRejectedValue(
        new Error('ECONNREFUSED')
      )

      const res = await request(buildApp().callback())
        .post('/auth/contacts/refresh')
        .send({ refreshToken: 'rt' })

      expect(res.status).toBe(502)
      expect(res.body.error).toBe('keycloak_unavailable')
    })
  })

  describe('POST /auth/contacts/logout', () => {
    it('returns 503 when contacts Keycloak is not configured', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(false)

      const res = await request(buildApp().callback())
        .post('/auth/contacts/logout')
        .send({ refreshToken: 'rt' })

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('contacts_keycloak_not_configured')
    })

    it('returns 400 when refreshToken is missing', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)

      const res = await request(buildApp().callback())
        .post('/auth/contacts/logout')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('missing_refresh_token')
      expect(mocked.logoutContactsSession).not.toHaveBeenCalled()
    })

    it('returns 204 when the session is ended', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.logoutContactsSession.mockResolvedValue()

      const res = await request(buildApp().callback())
        .post('/auth/contacts/logout')
        .send({ refreshToken: 'rt' })

      expect(res.status).toBe(204)
      expect(mocked.logoutContactsSession).toHaveBeenCalledWith('rt')
    })

    it('returns 400 invalid_grant when the session is already gone', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.logoutContactsSession.mockRejectedValue(
        keycloakAxiosError(400, { error: 'invalid_grant' })
      )

      const res = await request(buildApp().callback())
        .post('/auth/contacts/logout')
        .send({ refreshToken: 'rt' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_grant')
    })

    it('returns 502 when Keycloak is unreachable', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.logoutContactsSession.mockRejectedValue(new Error('ECONNREFUSED'))

      const res = await request(buildApp().callback())
        .post('/auth/contacts/logout')
        .send({ refreshToken: 'rt' })

      expect(res.status).toBe(502)
      expect(res.body.error).toBe('keycloak_unavailable')
    })
  })
})
