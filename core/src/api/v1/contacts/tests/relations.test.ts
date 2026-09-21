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
import { ProcessStatus } from '../../../../common/types'
import * as contactsProcesses from '../../../../processes/contacts'

type TestUser = {
  name?: string
  preferred_username: string
  realm_access: { roles: string[] }
}

const WRITER: TestUser = {
  name: 'Anna Andersson',
  preferred_username: 'anna',
  realm_access: { roles: ['api-access', 'contacts:write'] },
}
// A token that carries no display name, only the username.
const WRITER_WITHOUT_NAME: TestUser = {
  preferred_username: 'cecilia',
  realm_access: { roles: ['api-access', 'contacts:write'] },
}
// A token whose display name is present but empty, so `||` must skip it.
const WRITER_WITH_EMPTY_NAME: TestUser = {
  name: '',
  preferred_username: 'cecilia',
  realm_access: { roles: ['api-access', 'contacts:write'] },
}
// A display name that is present but blank. `||` keeps it (it is truthy), so
// only trimming stops it reaching contacts, which rejects a blank actor.
const WRITER_WITH_BLANK_NAME: TestUser = {
  name: '   ',
  preferred_username: 'cecilia',
  realm_access: { roles: ['api-access', 'contacts:write'] },
}
// A display name longer than the NVARCHAR(100) the contacts service stores.
const WRITER_WITH_LONG_NAME: TestUser = {
  name: 'L'.repeat(120),
  preferred_username: 'ludvig',
  realm_access: { roles: ['api-access', 'contacts:write'] },
}
const READER: TestUser = {
  name: 'Bo Reader',
  preferred_username: 'bo',
  realm_access: { roles: ['api-access'] },
}
// Relations need api-access even though they no longer need contacts:write,
// so a token carrying neither must still be refused.
const NO_ROLES: TestUser = {
  name: 'Noll Rollsson',
  preferred_username: 'noll',
  realm_access: { roles: [] },
}
let mockUser: TestUser = WRITER

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
})

afterEach(() => {
  jest.restoreAllMocks()
})

const relation = {
  contactCode: 'P2',
  role: 'trustee' as const,
  fullName: 'X Y',
  firstName: 'X',
  lastName: 'Y',
}

describe('POST /v1/contacts/:contactCode/relations', () => {
  it('forwards the body with the user name as createdBy and returns 201', async () => {
    const addSpy = jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: { relations: [relation] },
        httpStatus: 201,
      })

    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(res.status).toBe(201)
    expect(res.body.content.relations).toEqual([relation])
    expect(addSpy).toHaveBeenCalledWith({
      contactCode: 'P1',
      relatedContactCode: 'P2',
      roleType: 'god_man',
      createdBy: 'Anna Andersson',
    })
  })

  it('ignores a client-supplied createdBy', async () => {
    const addSpy = jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: { relations: [] },
        httpStatus: 201,
      })

    await request(app.callback()).post('/v1/contacts/P1/relations').send({
      relatedContactCode: 'P2',
      roleType: 'god_man',
      createdBy: 'spoof',
    })

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'Anna Andersson' })
    )
  })

  it('passes the process status, error and detail through', async () => {
    jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.failed,
        error: 'guardian-exists',
        httpStatus: 409,
        response: { detail: 'P9' },
      })

    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'guardian-exists', detail: 'P9' })
  })

  // The process, not the route, decides when propagation to Tenfast/Xledger
  // has failed. The route's job is only to forward what it returns.
  it('answers 502 when propagation fails', async () => {
    jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.failed,
        error: 'propagation-failed',
        httpStatus: 502,
        response: { detail: 'tenfast' },
      })

    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('propagation-failed')
  })

  it('falls back to preferred_username when the name is only whitespace', async () => {
    mockUser = WRITER_WITH_BLANK_NAME
    const addSpy = jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: { relations: [] },
        httpStatus: 201,
      })

    await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'cecilia' })
    )
  })

  it('falls back to preferred_username when the token has no name', async () => {
    mockUser = WRITER_WITHOUT_NAME
    const addSpy = jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: { relations: [] },
        httpStatus: 201,
      })

    await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'cecilia' })
    )
  })

  it('falls back to preferred_username when the name is empty', async () => {
    mockUser = WRITER_WITH_EMPTY_NAME
    const addSpy = jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: { relations: [] },
        httpStatus: 201,
      })

    await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'cecilia' })
    )
  })

  it('truncates a long display name to 100 characters', async () => {
    mockUser = WRITER_WITH_LONG_NAME
    const addSpy = jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: { relations: [] },
        httpStatus: 201,
      })

    await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    const { createdBy } = addSpy.mock.calls[0][0]
    expect(createdBy).toHaveLength(100)
    expect(createdBy).toBe(WRITER_WITH_LONG_NAME.name?.slice(0, 100))
  })

  it('rejects an invalid body with 400 before calling the process', async () => {
    const addSpy = jest.spyOn(contactsProcesses, 'addRelationWithPropagation')

    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'nyttjare' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-request')
    expect(addSpy).not.toHaveBeenCalled()
  })

  // contacts:write fences creating a contact, which writes to Xpand and
  // cannot be undone. A relation is reversible and rolls back on a failed
  // propagation, so plain api-access is enough.
  it('allows api-access without contacts:write', async () => {
    mockUser = READER
    const addSpy = jest
      .spyOn(contactsProcesses, 'addRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: { relations: [relation] },
        httpStatus: 201,
      })

    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })

    expect(res.status).toBe(201)
    expect(addSpy).toHaveBeenCalledWith({
      contactCode: 'P1',
      relatedContactCode: 'P2',
      roleType: 'god_man',
      createdBy: 'Bo Reader',
    })
  })

  it('is still 403 for a token with no roles at all', async () => {
    mockUser = NO_ROLES
    const addSpy = jest.spyOn(contactsProcesses, 'addRelationWithPropagation')
    const res = await request(app.callback())
      .post('/v1/contacts/P1/relations')
      .send({ relatedContactCode: 'P2', roleType: 'god_man' })
    expect(res.status).toBe(403)
    expect(addSpy).not.toHaveBeenCalled()
  })
})

describe('DELETE /v1/contacts/:contactCode/relations/:roleType/:relatedContactCode', () => {
  it('forwards with the user name as deletedBy and returns 204', async () => {
    const removeSpy = jest
      .spyOn(contactsProcesses, 'removeRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: undefined,
        httpStatus: 204,
      })

    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/god_man/P2'
    )

    expect(res.status).toBe(204)
    expect(removeSpy).toHaveBeenCalledWith({
      contactCode: 'P1',
      relatedContactCode: 'P2',
      roleType: 'god_man',
      deletedBy: 'Anna Andersson',
    })
  })

  it('passes relation-not-found through as 404', async () => {
    jest
      .spyOn(contactsProcesses, 'removeRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.failed,
        error: 'relation-not-found',
        httpStatus: 404,
      })
    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/god_man/P2'
    )
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'relation-not-found' })
  })

  // The process, not the route, decides when propagation to Tenfast has
  // failed. The route's job is only to forward what it returns.
  it('answers 502 when propagation fails', async () => {
    jest
      .spyOn(contactsProcesses, 'removeRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.failed,
        error: 'propagation-failed',
        httpStatus: 502,
        response: { detail: 'tenfast' },
      })

    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/god_man/P2'
    )

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('propagation-failed')
    // Forwarding `detail` on DELETE is the one behavioural change this route
    // made — pin it so deleting the spread doesn't silently regress.
    expect(res.body.detail).toBe('tenfast')
  })

  it('rejects an unknown role type with 400', async () => {
    const removeSpy = jest.spyOn(
      contactsProcesses,
      'removeRelationWithPropagation'
    )
    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/nyttjare/P2'
    )
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-role-type')
    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('allows api-access without contacts:write', async () => {
    mockUser = READER
    const removeSpy = jest
      .spyOn(contactsProcesses, 'removeRelationWithPropagation')
      .mockResolvedValue({
        processStatus: ProcessStatus.successful,
        data: undefined,
        httpStatus: 204,
      })

    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/god_man/P2'
    )

    expect(res.status).toBe(204)
    expect(removeSpy).toHaveBeenCalledWith({
      contactCode: 'P1',
      relatedContactCode: 'P2',
      roleType: 'god_man',
      deletedBy: 'Bo Reader',
    })
  })

  it('is still 403 for a token with no roles at all', async () => {
    mockUser = NO_ROLES
    const removeSpy = jest.spyOn(
      contactsProcesses,
      'removeRelationWithPropagation'
    )
    const res = await request(app.callback()).delete(
      '/v1/contacts/P1/relations/god_man/P2'
    )
    expect(res.status).toBe(403)
    expect(removeSpy).not.toHaveBeenCalled()
  })
})
