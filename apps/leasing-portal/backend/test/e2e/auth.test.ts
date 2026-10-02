import request from 'supertest'
import { makeTestApp } from './app-fixture'

const profile = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  source: 'keycloak',
  realm_access: { roles: ['leasing'] },
}

describe('GET /leasing-portal/auth/profile', () => {
  it('rejects requests without a token before calling core', async () => {
    const { app, coreClient } = makeTestApp()

    const res = await request(app.callback()).get(
      '/leasing-portal/auth/profile'
    )

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'unauthenticated' })
    expect(coreClient.calls).toHaveLength(0)
  })

  it('forwards the auth_token cookie to core as a bearer and returns the profile', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({ ok: true, status: 200, data: profile })

    const res = await request(app.callback())
      .get('/leasing-portal/auth/profile')
      .set('Cookie', 'auth_token=cookie-token')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(profile)
    expect(coreClient.calls).toEqual([
      {
        accessToken: 'cookie-token',
        req: { method: 'get', path: '/auth/profile' },
      },
    ])
  })

  it('accepts a bearer header when no cookie is present', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({ ok: true, status: 200, data: profile })

    const res = await request(app.callback())
      .get('/leasing-portal/auth/profile')
      .set('Authorization', 'Bearer header-token')

    expect(res.status).toBe(200)
    expect(coreClient.calls[0].accessToken).toBe('header-token')
  })

  it('passes a core 401 through with core body so the frontend can refresh', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({
      ok: false,
      status: 401,
      error: { message: 'Token expired' },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/auth/profile')
      .set('Cookie', 'auth_token=stale')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ message: 'Token expired' })
  })

  it('passes any core 4xx through unchanged', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({
      ok: false,
      status: 403,
      error: { message: 'Forbidden', requiredRoles: ['leasing'] },
    })

    const res = await request(app.callback())
      .get('/leasing-portal/auth/profile')
      .set('Cookie', 'auth_token=token')

    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      message: 'Forbidden',
      requiredRoles: ['leasing'],
    })
  })

  it('maps core 5xx and network failure to 502', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({ ok: false, status: 503, error: 'down' })

    const res = await request(app.callback())
      .get('/leasing-portal/auth/profile')
      .set('Cookie', 'auth_token=token')

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'core-unavailable' })
  })

  it('returns 502 when core answers with an unexpected shape', async () => {
    const { app, coreClient } = makeTestApp()
    coreClient.respondWith({ ok: true, status: 200, data: { nope: true } })

    const res = await request(app.callback())
      .get('/leasing-portal/auth/profile')
      .set('Cookie', 'auth_token=token')

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'unexpected-core-response' })
  })
})
