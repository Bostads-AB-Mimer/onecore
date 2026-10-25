import KoaRouter from '@koa/router'
import { Context, Next } from 'koa'
import request from 'supertest'

// The role gate in app.ts picks the role by path prefix, which only holds while
// routes have absolute paths. Token extraction and requireAuth are replaced
// with a stub that puts the roles from the x-roles header on ctx.state.user;
// requireRole is the real implementation.

jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  generateRouteMetadata: jest.fn(() => ({})),
  loggerMiddlewares: {
    pre: async (_ctx: Context, next: Next) => next(),
    post: async (_ctx: Context, next: Next) => next(),
  },
}))

jest.mock('../middlewares/extract-token', () => ({
  extractToken: async (_ctx: Context, next: Next) => next(),
}))

jest.mock('../middlewares/keycloak-auth', () => {
  const actual = jest.requireActual('../middlewares/keycloak-auth')
  return {
    ...actual,
    requireAuth: async (ctx: Context, next: Next) => {
      const roles = String(ctx.get('x-roles') || '')
        .split(',')
        .filter(Boolean)
      ctx.state.user = { realm_access: { roles } }
      return next()
    },
  }
})

import app from '../app'

describe('route paths', () => {
  it('are all absolute', () => {
    // router.routes() exposes its router on the middleware it returns.
    const paths = app.middleware.flatMap(
      (mw) =>
        (mw as { router?: KoaRouter }).router?.stack.map((layer) =>
          String(layer.path)
        ) ?? []
    )

    expect(paths.length).toBeGreaterThan(100)
    expect(paths.filter((path) => !path.startsWith('/'))).toEqual([])
  })

  it.each([
    ['infobip-webhook', 'post', '/webhooks/infobip/sendBulkSms'],
    ['scanner-upload', 'get', '/scan-receipt/files'],
    ['contacts:read', 'get', '/v1/contacts/x/communication-log/dispatches/1'],
  ])(
    'keep a %s account to its own routes (%s %s)',
    async (role, method, path) => {
      const res = await request(app.callback())
        [method as 'get' | 'post'](path)
        .set('x-roles', role)

      expect(res.status).toBe(404)
    }
  )

  it('serves health only at /health', async () => {
    // Not the public health route, so it needs api-access like everything else.
    const res = await request(app.callback()).get('/x/health')

    expect(res.status).toBe(403)
  })
})
