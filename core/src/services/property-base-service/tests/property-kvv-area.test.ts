import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes as propertyKvvAreaRoutes } from '../property-kvv-area'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'

function appWithUserRoles(
  roles: string[],
  user: { preferred_username?: string; email?: string } = {}
) {
  const a = new Koa()
  const r = new KoaRouter()
  a.use(async (ctx, next) => {
    ctx.state.user = { ...user, realm_access: { roles } }
    await next()
  })
  a.use(bodyParser())
  propertyKvvAreaRoutes(r)
  a.use(r.routes())
  return a
}

beforeEach(jest.resetAllMocks)

const KVV_AREA_ID = '22222222-2222-2222-2222-222222222222'
const PROPERTY_CODE = '04101'

describe('PUT /properties/:propertyCode/kvv-area', () => {
  it('returns 200 with the upserted link on success', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'updatePropertyKvvArea')
      .mockResolvedValueOnce({
        ok: true,
        data: {
          propertyCode: PROPERTY_CODE,
          kvvAreaId: KVV_AREA_ID,
          updatedAt: '2026-06-01T10:00:00.000Z',
          updatedBy: 'alice',
        },
      })

    const app = appWithUserRoles(['property-areas:write'], {
      preferred_username: 'alice',
    })

    const res = await request(app.callback())
      .put(`/properties/${PROPERTY_CODE}/kvv-area`)
      .send({ kvvAreaId: KVV_AREA_ID })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      propertyCode: PROPERTY_CODE,
      kvvAreaId: KVV_AREA_ID,
      updatedAt: '2026-06-01T10:00:00.000Z',
      updatedBy: 'alice',
    })
    expect(spy).toHaveBeenCalledWith(PROPERTY_CODE, {
      kvvAreaId: KVV_AREA_ID,
      updatedBy: 'alice',
    })
  })

  it('falls back to email when preferred_username is missing', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'updatePropertyKvvArea')
      .mockResolvedValueOnce({
        ok: true,
        data: {
          propertyCode: PROPERTY_CODE,
          kvvAreaId: KVV_AREA_ID,
          updatedAt: '2026-06-01T10:00:00.000Z',
          updatedBy: 'a@b.se',
        },
      })

    const app = appWithUserRoles(['property-areas:write'], {
      email: 'a@b.se',
    })

    await request(app.callback())
      .put(`/properties/${PROPERTY_CODE}/kvv-area`)
      .send({ kvvAreaId: KVV_AREA_ID })

    expect(spy).toHaveBeenCalledWith(PROPERTY_CODE, {
      kvvAreaId: KVV_AREA_ID,
      updatedBy: 'a@b.se',
    })
  })

  it('returns 403 without the property-areas:write role', async () => {
    const spy = jest.spyOn(propertyBaseAdapter, 'updatePropertyKvvArea')

    const app = appWithUserRoles(['some-other-role'])
    const res = await request(app.callback())
      .put(`/properties/${PROPERTY_CODE}/kvv-area`)
      .send({ kvvAreaId: KVV_AREA_ID })

    expect(res.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns 400 when kvvAreaId is missing', async () => {
    const app = appWithUserRoles(['property-areas:write'])
    const res = await request(app.callback())
      .put(`/properties/${PROPERTY_CODE}/kvv-area`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when kvvAreaId is not a uuid', async () => {
    const app = appWithUserRoles(['property-areas:write'])
    const res = await request(app.callback())
      .put(`/properties/${PROPERTY_CODE}/kvv-area`)
      .send({ kvvAreaId: 'not-a-uuid' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when the property is not found', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'updatePropertyKvvArea')
      .mockResolvedValueOnce({ ok: false, err: 'property-not-found' })

    const app = appWithUserRoles(['property-areas:write'])
    const res = await request(app.callback())
      .put(`/properties/${PROPERTY_CODE}/kvv-area`)
      .send({ kvvAreaId: KVV_AREA_ID })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Property not found')
  })

  it('returns 404 when the kvv-area is not found', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'updatePropertyKvvArea')
      .mockResolvedValueOnce({ ok: false, err: 'kvv-area-not-found' })

    const app = appWithUserRoles(['property-areas:write'])
    const res = await request(app.callback())
      .put(`/properties/${PROPERTY_CODE}/kvv-area`)
      .send({ kvvAreaId: KVV_AREA_ID })

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('KVV-area not found')
  })

  it('returns 500 on unknown adapter error', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'updatePropertyKvvArea')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const app = appWithUserRoles(['property-areas:write'])
    const res = await request(app.callback())
      .put(`/properties/${PROPERTY_CODE}/kvv-area`)
      .send({ kvvAreaId: KVV_AREA_ID })

    expect(res.status).toBe(500)
  })
})
