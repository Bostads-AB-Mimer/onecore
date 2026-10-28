import { Context, Next } from 'koa'
import request from 'supertest'

// The gate under test sits in app.ts behind token extraction and requireAuth.
// Both are replaced with a stub that puts the roles from the x-roles header on
// ctx.state.user; requireRole itself is the real implementation.

// app.ts pulls in modules that need the real utilities exports; the global
// jest setup only stubs a few of them.
jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  generateRouteMetadata: jest.fn(() => ({})),
  loggerMiddlewares: {
    pre: async (_ctx: Context, next: Next) => next(),
    post: async (_ctx: Context, next: Next) => next(),
  },
}))

jest.mock('../../../middlewares/extract-token', () => ({
  extractToken: async (_ctx: Context, next: Next) => next(),
}))

jest.mock('../../../middlewares/keycloak-auth', () => {
  const actual = jest.requireActual('../../../middlewares/keycloak-auth')
  return {
    ...actual,
    requireAuth: async (ctx: Context, next: Next) => {
      const roles = String(ctx.get('x-roles') || '')
        .split(',')
        .filter(Boolean)
      ctx.state.user = { name: 'Anna', realm_access: { roles } }
      return next()
    },
  }
})

import * as communicationAdapter from '../../../adapters/communication-adapter'
import app from '../../../app'

const asReader = { 'x-roles': 'api-access' }

describe('guides-admin role gate', () => {
  it('rejects writes for users without the role, whatever the path casing', async () => {
    const uuid = '3f1d9b3e-1f9a-4f5c-9a6e-2c2a5b6d7e8f'

    const post = await request(app.callback())
      .post('/GUIDES')
      .set(asReader)
      .send({})
    expect(post.status).toBe(403)

    const del = await request(app.callback())
      .delete(`/Guides/${uuid}`)
      .set(asReader)
    expect(del.status).toBe(403)
  })

  it('lets readers through on GET', async () => {
    jest
      .spyOn(communicationAdapter.guides, 'listCategories')
      .mockResolvedValue({ ok: true, data: [] })

    const res = await request(app.callback())
      .get('/guides/categories')
      .set(asReader)

    expect(res.status).toBe(200)
  })
})
