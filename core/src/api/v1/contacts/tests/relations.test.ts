jest.mock('@onecore/utilities', () => {
  const actual = jest.requireActual('@onecore/utilities')
  return {
    ...actual,
    logger: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    },
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-body'
import { makeOkapiRouter } from 'koa-okapi-router'

import { requireRole } from '../../../../middlewares/keycloak-auth'
import { requiredRolesFor } from '../../../../middlewares/route-roles'
import { routes } from '../index'
import config from '../../../../common/config'
import * as contactsAdapterModule from '../../../../adapters/contacts-adapter'

const WRITER = {
  name: 'Anna Andersson',
  preferred_username: 'anna',
  realm_access: { roles: ['api-access', 'contacts:write'] },
}
const READER = {
  name: 'Bo Reader',
  preferred_username: 'bo',
  realm_access: { roles: ['api-access'] },
}
let mockUser: typeof WRITER = WRITER

const adapter = {
  addRelation: jest.fn(),
  removeRelation: jest.fn(),
}

// makeContactsAdapter is called inside routes(), so the spy must be in place
// before the router is built.
jest
  .spyOn(contactsAdapterModule, 'makeContactsAdapter')
  .mockReturnValue(adapter as never)

const app = new Koa()
app.use(bodyParser())
app.use((ctx, next) => {
  ctx.state.user = mockUser
  return next()
})
app.use((ctx, next) =>
  requireRole(requiredRolesFor(ctx.path, ctx.method))(ctx, next)
)
const router = makeOkapiRouter(new KoaRouter(), {
  openapi: { info: { title: 'test' } },
})
routes(router, config)
app.use(router.routes())

beforeEach(() => {
  mockUser = WRITER
  adapter.addRelation.mockReset()
  adapter.removeRelation.mockReset()
})

const relation = {
  contactCode: 'P2',
  role: 'trustee',
  fullName: 'X Y',
  firstName: 'X',
  lastName: 'Y',
}

describe('POST /v1/contacts/:contactCode/relations', () => {
  it('forwards the body with the user name as createdBy and returns 201', async () => {
    adapter.addRelation.mockResolvedValue({
      ok: true,
      data: { relations: [relation] },
    })

    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(res.status).toBe(201)
    expect(res.body.content.relations).toEqual([relation])
    expect(adapter.addRelation).toHaveBeenCalledWith({
      contactCode: 'P1',
      relatedContactCode: 'P2',
      roleType: 'god_man',
      createdBy: 'Anna Andersson',
    })
  })

  it('ignores a client-supplied createdBy', async () => {
    adapter.addRelation.mockResolvedValue({ ok: true, data: { relations: [] } })

    await request(app.callback()).post('/v1/contacts/P1/relations').send({
      relatedContactCode: 'P2',
      roleType: 'god_man',
      createdBy: 'spoof',
    })

    expect(adapter.addRelation).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'Anna Andersson' })
    )
  })

  it('passes the contacts status and error through', async () => {
    adapter.addRelation.mockResolvedValue({
      ok: false,
      err: 'guardian-exists',
      detail: 'P9',
      statusCode: 409,
    })

    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'guardian-exists', detail: 'P9' })
  })

  it('rejects an invalid body with 400 before calling contacts', async () => {
    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'nyttjare' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-request')
    expect(adapter.addRelation).not.toHaveBeenCalled()
  })

  it('is 403 without contacts:write', async () => {
    mockUser = READER
    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })
    expect(res.status).toBe(403)
    expect(adapter.addRelation).not.toHaveBeenCalled()
  })
})

describe('DELETE /v1/contacts/:contactCode/relations/:roleType/:relatedContactCode', () => {
  it('forwards with the user name as deletedBy and returns 204', async () => {
    adapter.removeRelation.mockResolvedValue({ ok: true, data: undefined })

    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/god_man/P2'
    )

    expect(res.status).toBe(204)
    expect(adapter.removeRelation).toHaveBeenCalledWith({
      contactCode: 'P1',
      relatedContactCode: 'P2',
      roleType: 'god_man',
      deletedBy: 'Anna Andersson',
    })
  })

  it('passes relation-not-found through as 404', async () => {
    adapter.removeRelation.mockResolvedValue({
      ok: false,
      err: 'relation-not-found',
      statusCode: 404,
    })
    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/god_man/P2'
    )
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'relation-not-found' })
  })

  it('rejects an unknown role type with 400', async () => {
    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/nyttjare/P2'
    )
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-role-type')
    expect(adapter.removeRelation).not.toHaveBeenCalled()
  })

  it('is 403 without contacts:write', async () => {
    mockUser = READER
    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/god_man/P2'
    )
    expect(res.status).toBe(403)
  })
})
