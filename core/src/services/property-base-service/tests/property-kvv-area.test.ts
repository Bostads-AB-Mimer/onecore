import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes as propertyKvvAreaRoutes } from '../property-kvv-area'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as keycloakAdapter from '../../auth-service/keycloak-admin-adapter'

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

const RESPONSIBLE_ID = '44444444-4444-4444-4444-444444444444'
const COST_CENTER_ID = '33333333-3333-3333-3333-333333333333'

const lookupFromService = () => ({
  kvvArea: { id: KVV_AREA_ID, code: '61141', name: 'Distrikt Väst: SKÄLBY' },
  costCenter: { id: COST_CENTER_ID, code: '61140', name: 'Distrikt Väst' },
  responsibleKeycloakUserId: RESPONSIBLE_ID,
})

describe('GET /properties/:propertyCode/kvv-area', () => {
  it('resolves the responsible by id without fetching the whole role list', async () => {
    const byId = jest
      .spyOn(keycloakAdapter, 'getUserById')
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: RESPONSIBLE_ID,
          username: 'rodrigo.garcia',
          firstName: 'Rodrigo',
          lastName: 'Garcia',
          email: 'rodrigo@example.com',
          attributes: { mobilePhone: ['070-0000000'], employeeId: ['E-7'] },
        },
      })
    const byRole = jest.spyOn(keycloakAdapter, 'getUsersByRole')
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValueOnce({ ok: true, data: lookupFromService() })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/properties/${PROPERTY_CODE}/kvv-area`
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      kvvArea: {
        id: KVV_AREA_ID,
        code: '61141',
        name: 'Distrikt Väst: SKÄLBY',
      },
      costCenter: { id: COST_CENTER_ID, code: '61140', name: 'Distrikt Väst' },
      responsible: {
        id: RESPONSIBLE_ID,
        username: 'rodrigo.garcia',
        firstName: 'Rodrigo',
        lastName: 'Garcia',
        email: 'rodrigo@example.com',
        mobilePhone: '070-0000000',
        employeeId: 'E-7',
      },
    })
    expect(spy).toHaveBeenCalledWith(PROPERTY_CODE)
    expect(byId).toHaveBeenCalledWith(RESPONSIBLE_ID)
    // Odoo hits this per errand — the role list is uncached, don't fetch it.
    expect(byRole).not.toHaveBeenCalled()
  })

  it('still returns the district when Keycloak omits the user name fields', async () => {
    // Keycloak returns null (not undefined) for unset optional attributes.
    jest.spyOn(keycloakAdapter, 'getUserById').mockResolvedValueOnce({
      ok: true,
      data: {
        id: RESPONSIBLE_ID,
        username: 'rodrigo.garcia',
        firstName: null,
        lastName: null,
        email: null,
      } as unknown as keycloakAdapter.KeycloakUser,
    })
    jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValueOnce({ ok: true, data: lookupFromService() })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/properties/${PROPERTY_CODE}/kvv-area`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.costCenter.name).toBe('Distrikt Väst')
    expect(res.body.content.responsible).toMatchObject({
      id: RESPONSIBLE_ID,
      username: 'rodrigo.garcia',
    })
  })

  it('returns the district with responsible null when Keycloak throws', async () => {
    jest
      .spyOn(keycloakAdapter, 'getUserById')
      .mockRejectedValueOnce(new Error('socket hang up'))
    jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValueOnce({ ok: true, data: lookupFromService() })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/properties/${PROPERTY_CODE}/kvv-area`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.costCenter.code).toBe('61140')
    expect(res.body.content.responsible).toBeNull()
  })

  it('returns responsible null when the Keycloak lookup fails', async () => {
    jest.spyOn(keycloakAdapter, 'getUserById').mockResolvedValueOnce({
      ok: false,
      err: 'keycloak_unreachable',
      statusCode: 502,
    })
    jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValueOnce({ ok: true, data: lookupFromService() })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/properties/${PROPERTY_CODE}/kvv-area`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.responsible).toBeNull()
    expect(res.body.content.costCenter.code).toBe('61140')
  })

  it('returns responsible null when the area has no responsible set', async () => {
    const users = jest.spyOn(keycloakAdapter, 'getUserById')
    jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValueOnce({
        ok: true,
        data: { ...lookupFromService(), responsibleKeycloakUserId: null },
      })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/properties/${PROPERTY_CODE}/kvv-area`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.responsible).toBeNull()
    expect(users).not.toHaveBeenCalled()
  })

  it('returns 404 when the property has no kvv-area link', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/properties/${PROPERTY_CODE}/kvv-area`
    )

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Property has no KVV-area')
    // Discriminator so callers can tell "property has no link" apart from a
    // routing 404 (Odoo treats the former as "no district", not as an error).
    expect(res.body.code).toBe('PROPERTY_KVV_AREA_NOT_FOUND')
  })

  it('returns 500 on unknown adapter error', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/properties/${PROPERTY_CODE}/kvv-area`
    )

    expect(res.status).toBe(500)
  })
})

describe('GET /rental-objects/:rentalId/kvv-area', () => {
  const RENTAL_ID = '307-048-01-0201'

  it('returns the object-level resolution with the responsible hydrated', async () => {
    jest.spyOn(keycloakAdapter, 'getUserById').mockResolvedValueOnce({
      ok: true,
      data: {
        id: RESPONSIBLE_ID,
        username: 'rodrigo.garcia',
        firstName: 'Rodrigo',
        lastName: 'Garcia',
        email: 'rodrigo@example.com',
        attributes: { mobilePhone: ['070-0000000'], employeeId: ['E-7'] },
      },
    })
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByRentalId')
      .mockResolvedValueOnce({ ok: true, data: lookupFromService() })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/rental-objects/${RENTAL_ID}/kvv-area`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.kvvArea.code).toBe('61141')
    expect(res.body.content.responsible).toMatchObject({
      id: RESPONSIBLE_ID,
      username: 'rodrigo.garcia',
    })
    expect(spy).toHaveBeenCalledWith(RENTAL_ID)
  })

  it('returns 404 with a discriminator code when nothing resolves', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByRentalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/rental-objects/${RENTAL_ID}/kvv-area`
    )

    expect(res.status).toBe(404)
    expect(res.body.code).toBe('RENTAL_OBJECT_KVV_AREA_NOT_FOUND')
  })

  it('returns 500 on unknown adapter error', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getKvvAreaByRentalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const app = appWithUserRoles([])
    const res = await request(app.callback()).get(
      `/rental-objects/${RENTAL_ID}/kvv-area`
    )

    expect(res.status).toBe(500)
  })
})
