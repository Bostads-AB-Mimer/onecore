import Koa from 'koa'
import KoaRouter from '@koa/router'
import request from 'supertest'
import { Context, Next } from 'koa'

jest.mock('../keycloak', () => ({ __esModule: true, default: {} }))

jest.mock('../../../middlewares/extract-token', () => ({
  extractToken: async (_ctx: Context, next: Next) => next(),
}))

// requireAuth is replaced by a stub that puts the roles from the x-roles
// header on the user; requireRole is the real implementation.
jest.mock('../../../middlewares/keycloak-auth', () => ({
  ...jest.requireActual('../../../middlewares/keycloak-auth'),
  requireAuth: async (ctx: Context, next: Next) => {
    const roles = String(ctx.get('x-roles') || '')
      .split(',')
      .filter(Boolean)
    ctx.state.user = { id: 'caller', realm_access: { roles } }
    return next()
  },
}))

jest.mock('../keycloak-admin-adapter', () => ({
  getUsersByRole: jest.fn(),
}))

import { getUsersByRole } from '../keycloak-admin-adapter'
import { routes } from '../index'

const router = new KoaRouter()
routes(router)
const app = new Koa().use(router.routes())

const getUsers = (roles: string) =>
  request(app.callback())
    .get('/auth/roles/property-manager/users')
    .set('x-roles', roles)

beforeEach(() => {
  jest.mocked(getUsersByRole).mockResolvedValue({
    ok: true,
    data: [
      {
        id: 'u1',
        username: 'anna',
        firstName: 'Anna',
        lastName: 'Svensson',
        email: 'anna@example.com',
        emailVerified: true,
        attributes: {
          employeeId: ['YY2333'],
          mobilePhone: ['0701234567'],
          entraId: ['secret-ish'],
        },
        enabled: true,
        requiredActions: ['UPDATE_PASSWORD'],
      },
    ],
  })
})

describe('GET /auth/roles/:roleName/users', () => {
  it('rejects users without api-access', async () => {
    const res = await getUsers('scanner-upload')

    expect(res.status).toBe(403)
    expect(getUsersByRole).not.toHaveBeenCalled()
  })

  it('returns only the fields clients use', async () => {
    const res = await getUsers('api-access')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      {
        id: 'u1',
        username: 'anna',
        firstName: 'Anna',
        lastName: 'Svensson',
        attributes: {
          employeeId: ['YY2333'],
          mobilePhone: ['0701234567'],
        },
      },
    ])
  })
})
