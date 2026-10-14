import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import request from 'supertest'

import { registerContactsAuthRoutes } from '../contacts-auth-routes'
import * as contactsKeycloak from '../keycloak-contacts'

jest.mock('../keycloak-contacts', () => ({
  isContactsKeycloakConfigured: jest.fn(),
  exchangeContactsAuthorizationCode: jest.fn(),
  refreshContactsAccessToken: jest.fn(),
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

describe('contacts auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /auth/contacts/callback', () => {
    it('returns 503 when contacts Keycloak is not configured', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(false)

      const res = await request(buildApp().callback())
        .post('/auth/contacts/callback')
        .send({ code: 'abc', redirectUri: 'https://example/cb' })

      expect(res.status).toBe(503)
      expect(res.body.error).toBe('contacts_keycloak_not_configured')
    })

    it('returns 400 when code is missing', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)

      const res = await request(buildApp().callback())
        .post('/auth/contacts/callback')
        .send({ redirectUri: 'https://example/cb' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('missing_authorization_code')
    })

    it('returns tokens and user on success', async () => {
      mocked.isContactsKeycloakConfigured.mockReturnValue(true)
      mocked.exchangeContactsAuthorizationCode.mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 300,
        token_type: 'Bearer',
        user: {
          id: 'sub-1',
          email: 'test@example.com',
          name: 'Test User',
          preferred_username: '199001019999',
          realm_access: { roles: ['contact'] },
          source: 'keycloak',
        },
      })

      const res = await request(buildApp().callback())
        .post('/auth/contacts/callback')
        .send({
          code: 'auth-code',
          redirectUri: 'https://mina-sidor/callback',
        })

      expect(res.status).toBe(200)
      expect(res.body.access_token).toBe('access')
      expect(res.body.user.preferred_username).toBe('199001019999')
      expect(mocked.exchangeContactsAuthorizationCode).toHaveBeenCalledWith(
        'auth-code',
        'https://mina-sidor/callback'
      )
    })
  })

  describe('POST /auth/contacts/refresh', () => {
    it('returns 400 when refresh_token is missing', async () => {
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
        .send({ refresh_token: 'old-refresh' })

      expect(res.status).toBe(200)
      expect(res.body.access_token).toBe('new-access')
      expect(mocked.refreshContactsAccessToken).toHaveBeenCalledWith(
        'old-refresh'
      )
    })
  })
})
