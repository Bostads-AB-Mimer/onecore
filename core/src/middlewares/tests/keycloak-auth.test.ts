import Koa from 'koa'
import KoaRouter from '@koa/router'
import jwt from 'jsonwebtoken'
import { errors as joseErrors } from 'jose'
import request from 'supertest'

jest.mock('../../services/auth-service/keycloak', () => ({
  __esModule: true,
  default: { jwksService: { verifyToken: jest.fn() } },
}))

import auth from '../../services/auth-service/keycloak'
import config from '../../common/config'
import { requireAuth, requireRole } from '../keycloak-auth'

const verifyToken = jest.mocked(auth.jwksService.verifyToken)

// requireAuth only peeks at the header to tell legacy (HS256) tokens from
// Keycloak ones; the Keycloak verification itself is mocked.
const keycloakToken = [
  Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString(
    'base64url'
  ),
  Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url'),
  'signature',
].join('.')

const app = new Koa()
app.use(async (ctx, next) => {
  ctx.state.accessToken = ctx.get('Authorization').replace('Bearer ', '')
  await next()
})
const router = new KoaRouter()
// Like core's /auth/profile: answers with whatever user requireAuth set.
router.get('/profile', requireAuth, async (ctx) => {
  ctx.body = ctx.state.user
})
router.get('/protected', requireAuth, requireRole('api-access'), (ctx) => {
  ctx.body = { ok: true }
})
app.use(router.routes())

const get = (path: string, token = keycloakToken) =>
  request(app.callback()).get(path).set('Authorization', `Bearer ${token}`)

beforeEach(() => verifyToken.mockReset())

describe('requireAuth', () => {
  it('sets the user from a verified Keycloak token', async () => {
    verifyToken.mockResolvedValue({
      sub: 'user-1',
      email: 'anna@example.com',
      realm_access: { roles: ['api-access'] },
    })

    const res = await get('/profile')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 'user-1', source: 'keycloak' })
  })

  it.each([
    ['a key Keycloak no longer has', new joseErrors.JWKSNoMatchingKey()],
    ['a bad signature', new joseErrors.JWSSignatureVerificationFailed()],
    ['a malformed token', new joseErrors.JWSInvalid('Invalid Compact JWS')],
  ])('answers 401 for %s', async (_, error) => {
    verifyToken.mockRejectedValue(error)

    const profile = await get('/profile')
    expect(profile.status).toBe(401)
    expect(profile.body).toEqual({ message: 'Invalid token' })

    // Without a user requireRole used to fail its assertion with a 500.
    expect((await get('/protected')).status).toBe(401)
  })

  it('answers 401 for an expired token', async () => {
    verifyToken.mockRejectedValue(
      new joseErrors.JWTExpired('"exp" claim timestamp check failed', {})
    )

    const res = await get('/profile')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ message: 'Token expired' })
  })

  it('answers 401 for a token with the wrong issuer or audience', async () => {
    verifyToken.mockRejectedValue(
      new joseErrors.JWTClaimValidationFailed(
        'unexpected "iss" claim value',
        {},
        'iss',
        'check_failed'
      )
    )

    const res = await get('/profile')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ message: 'Invalid token' })
  })

  it.each([
    ['the keys cannot be fetched', new Error('connect ECONNREFUSED')],
    ['fetching the keys times out', new joseErrors.JWKSTimeout()],
    // What jose throws when Keycloak answers with an error page.
    [
      'the keys answer is not 200',
      new joseErrors.JOSEError(
        'Expected 200 OK from the JSON Web Key Set HTTP response'
      ),
    ],
    [
      'the keys answer is not JSON',
      new joseErrors.JOSEError(
        'Failed to parse the JSON Web Key Set HTTP response as JSON'
      ),
    ],
    ['the key set is invalid', new joseErrors.JWKSInvalid()],
  ])('answers 503 when %s', async (_, error) => {
    verifyToken.mockRejectedValue(error)

    const profile = await get('/profile')
    expect(profile.status).toBe(503)
    expect(profile.body).toEqual({
      message: 'Authentication service unavailable',
    })
    expect((await get('/protected')).status).toBe(503)
  })

  it('verifies legacy tokens without Keycloak', async () => {
    const legacyToken = jwt.sign(
      { sub: 'svc', username: 'svc' },
      config.auth.secret
    )

    const res = await get('/protected', legacyToken)

    expect(res.status).toBe(200)
    expect(verifyToken).not.toHaveBeenCalled()
  })
})
