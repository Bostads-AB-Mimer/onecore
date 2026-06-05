import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes as kvvAreaRoutes } from '../kvv-areas'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as keycloakAdapter from '../../auth-service/keycloak-admin-adapter'

const AREA_ID = '11111111-1111-1111-1111-111111111111'
const CALLER_ID = 'caller-keycloak-id'
const TARGET_USER_ID = '22222222-2222-2222-2222-222222222222'

function appWithUser(roles: string[], userId: string = CALLER_ID) {
  const a = new Koa()
  const r = new KoaRouter()
  a.use(async (ctx, next) => {
    ctx.state.user = { id: userId, realm_access: { roles } }
    await next()
  })
  a.use(bodyParser())
  kvvAreaRoutes(r)
  a.use(r.routes())
  return a
}

const updatedRecord = () => ({
  id: AREA_ID,
  code: 'KVV-1',
  name: 'Område 1',
  costCenterId: '33333333-3333-3333-3333-333333333333',
  responsibleKeycloakUserId: TARGET_USER_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-27T00:00:00.000Z',
  updatedBy: CALLER_ID,
})

beforeEach(jest.resetAllMocks)

describe('PATCH /kvv-areas/:id/responsible', () => {
  it('returns 403 when the caller lacks property-areas:write', async () => {
    const app = appWithUser(['some-other-role'])
    const res = await request(app.callback())
      .patch(`/kvv-areas/${AREA_ID}/responsible`)
      .send({ keycloakUserId: TARGET_USER_ID })

    expect(res.status).toBe(403)
  })

  it('returns 400 when the body is missing keycloakUserId', async () => {
    const app = appWithUser(['property-areas:write'])
    const res = await request(app.callback())
      .patch(`/kvv-areas/${AREA_ID}/responsible`)
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 when keycloakUserId is not a uuid', async () => {
    const app = appWithUser(['property-areas:write'])
    const res = await request(app.callback())
      .patch(`/kvv-areas/${AREA_ID}/responsible`)
      .send({ keycloakUserId: 'not-a-uuid' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when the target user is not a property-manager', async () => {
    jest
      .spyOn(keycloakAdapter, 'getUsersByRole')
      .mockResolvedValueOnce({ ok: true, data: [] })

    const app = appWithUser(['property-areas:write'])
    const res = await request(app.callback())
      .patch(`/kvv-areas/${AREA_ID}/responsible`)
      .send({ keycloakUserId: TARGET_USER_ID })

    expect(res.status).toBe(400)
    expect(res.body.reason).toMatch(/property manager/i)
  })

  it('returns 502 when keycloak lookup fails', async () => {
    jest.spyOn(keycloakAdapter, 'getUsersByRole').mockResolvedValueOnce({
      ok: false,
      err: 'keycloak_unreachable',
      statusCode: 502,
    })

    const app = appWithUser(['property-areas:write'])
    const res = await request(app.callback())
      .patch(`/kvv-areas/${AREA_ID}/responsible`)
      .send({ keycloakUserId: TARGET_USER_ID })

    expect(res.status).toBe(502)
  })

  it('returns 500 when the property service reports an unknown error', async () => {
    jest.spyOn(keycloakAdapter, 'getUsersByRole').mockResolvedValueOnce({
      ok: true,
      data: [{ id: TARGET_USER_ID, username: 'target' }],
    })
    jest
      .spyOn(propertyBaseAdapter, 'updateKvvAreaResponsible')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const app = appWithUser(['property-areas:write'])
    const res = await request(app.callback())
      .patch(`/kvv-areas/${AREA_ID}/responsible`)
      .send({ keycloakUserId: TARGET_USER_ID })

    expect(res.status).toBe(500)
  })

  it('returns 404 when the property service reports the area is missing', async () => {
    jest.spyOn(keycloakAdapter, 'getUsersByRole').mockResolvedValueOnce({
      ok: true,
      data: [{ id: TARGET_USER_ID, username: 'target' }],
    })
    jest
      .spyOn(propertyBaseAdapter, 'updateKvvAreaResponsible')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const app = appWithUser(['property-areas:write'])
    const res = await request(app.callback())
      .patch(`/kvv-areas/${AREA_ID}/responsible`)
      .send({ keycloakUserId: TARGET_USER_ID })

    expect(res.status).toBe(404)
  })

  it('returns 200 with hydrated responsible user on success', async () => {
    jest.spyOn(keycloakAdapter, 'getUsersByRole').mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: TARGET_USER_ID,
          username: 'target.user',
          firstName: 'Target',
          lastName: 'User',
          email: 'target@example.com',
          attributes: {
            mobilePhone: ['070-1234567'],
            employeeId: ['E-42'],
          },
        },
      ],
    })
    const adapterSpy = jest
      .spyOn(propertyBaseAdapter, 'updateKvvAreaResponsible')
      .mockResolvedValueOnce({ ok: true, data: updatedRecord() })

    const app = appWithUser(['property-areas:write'])
    const res = await request(app.callback())
      .patch(`/kvv-areas/${AREA_ID}/responsible`)
      .send({ keycloakUserId: TARGET_USER_ID })

    expect(res.status).toBe(200)
    expect(res.body.content).toMatchObject({
      id: AREA_ID,
      code: 'KVV-1',
      name: 'Område 1',
      responsible: {
        id: TARGET_USER_ID,
        username: 'target.user',
        firstName: 'Target',
        lastName: 'User',
        mobilePhone: '070-1234567',
        employeeId: 'E-42',
      },
    })
    expect(adapterSpy).toHaveBeenCalledWith(AREA_ID, {
      keycloakUserId: TARGET_USER_ID,
      updatedBy: CALLER_ID,
    })
  })
})
