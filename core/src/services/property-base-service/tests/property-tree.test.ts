import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes as propertyTreeRoutes } from '../property-tree'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as keycloakAdapter from '../../auth-service/keycloak-admin-adapter'
import type { components } from '../../../adapters/property-base-adapter/generated/api-types'

type PropertyTree = components['schemas']['PropertyTree']

const app = new Koa()
const router = new KoaRouter()
propertyTreeRoutes(router)
app.silent = true
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

const TREE_ID = '11111111-1111-1111-1111-111111111111'
const KVV_ID = '22222222-2222-2222-2222-222222222222'
const RESP_ID = 'responsible-user-id'

const property: PropertyTree['groups'][number]['properties'][number] = {
  code: '04101',
  designation: 'JOSEF 7',
  tract: 'Josef',
  buildings: [
    {
      buildingCode: '04101-B1',
      buildingName: 'Hus 1',
      buildingType: { code: 'STD', name: 'Standard' },
      staircases: [
        {
          code: '01',
          name: 'Hus 1 A',
          residenceCount: 12,
          parkingCount: 0,
          facilityCount: 1,
          otherCount: 0,
        },
      ],
      residenceCount: 26,
      parkingCount: 0,
      facilityCount: 1,
      otherCount: 0,
    },
  ],
  parkingAreas: [
    { code: '041-717-00', name: 'JOSEFS PARKERING', parkingCount: 4 },
  ],
  aggregates: {
    residenceCount: 26,
    parkingCount: 4,
    entranceCount: 5,
    facilityCount: 1,
    otherCount: 0,
  },
}

const costCenterTree: PropertyTree = {
  grouping: 'costCenter',
  id: TREE_ID,
  code: '61110',
  name: 'Mimer Mitt',
  groups: [
    {
      id: KVV_ID,
      code: 'KVV-1',
      name: 'Område 1',
      responsibleKeycloakUserId: RESP_ID,
      properties: [property],
    },
  ],
}

const marketAreaTree: PropertyTree = {
  grouping: 'marketArea',
  id: 'MO1',
  code: 'MO1',
  name: 'Centrum',
  groups: [
    {
      id: 'MO1',
      code: 'MO1',
      name: 'Centrum',
      responsibleKeycloakUserId: null,
      properties: [property],
    },
  ],
}

const mockUsers = (users: { id: string; username: string }[]) =>
  jest
    .spyOn(keycloakAdapter, 'getUsersByRole')
    .mockResolvedValue({ ok: true, data: users })

describe('GET /property-tree', () => {
  it('returns 400 when rootId is missing', async () => {
    const res = await request(app.callback()).get(
      '/property-tree?groupBy=costCenter'
    )
    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
  })

  it('returns 400 when groupBy is not a known grouping', async () => {
    const res = await request(app.callback()).get(
      `/property-tree?groupBy=district&rootId=${TREE_ID}`
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when the root does not exist', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })
    mockUsers([])

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )
    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Root not found')
  })

  it('returns 400 when the property service rejects the query', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: false, err: 'bad-request' })
    mockUsers([])

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )
    expect(res.status).toBe(400)
  })

  it('returns 500 when the adapter fails with unknown', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
    mockUsers([])

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )
    expect(res.status).toBe(500)
  })

  it('forwards groupBy and rootId to the adapter', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: true, data: costCenterTree })
    mockUsers([])

    await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )
    expect(spy).toHaveBeenCalledWith({
      groupBy: 'costCenter',
      rootId: TREE_ID,
    })
  })

  it('hydrates the group responsible from the property-manager role', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: true, data: costCenterTree })
    const users = mockUsers([{ id: RESP_ID, username: 'resp' }])

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )

    expect(res.status).toBe(200)
    expect(users).toHaveBeenCalledWith('property-manager')
    expect(res.body.content.groups[0].responsible).toMatchObject({
      id: RESP_ID,
      username: 'resp',
    })
  })

  it('replaces responsibleKeycloakUserId with the resolved user', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: true, data: costCenterTree })
    mockUsers([{ id: RESP_ID, username: 'resp' }])

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )

    expect(res.body.content.groups[0].responsibleKeycloakUserId).toBeUndefined()
  })

  it('returns the tree with a null responsible when keycloak fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: true, data: costCenterTree })
    jest.spyOn(keycloakAdapter, 'getUsersByRole').mockResolvedValue({
      ok: false,
      err: 'keycloak_unreachable',
      statusCode: 502,
    })

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.groups[0].responsible).toBeNull()
    expect(res.body.content.groups[0].properties).toHaveLength(1)
  })

  it('returns a null responsible for an id no role list holds', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: true, data: costCenterTree })
    mockUsers([{ id: 'someone-else', username: 'other' }])

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )

    expect(res.status).toBe(200)
    expect(res.body.content.groups[0].responsible).toBeNull()
  })

  it('skips keycloak entirely for groupings that have no responsible', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: true, data: marketAreaTree })
    const users = mockUsers([{ id: RESP_ID, username: 'resp' }])

    const res = await request(app.callback()).get(
      '/property-tree?groupBy=marketArea&rootId=MO1'
    )

    expect(res.status).toBe(200)
    expect(users).not.toHaveBeenCalled()
    expect(res.body.content.groups[0].responsible).toBeNull()
  })

  it('passes the property subtree through untouched', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: true, data: costCenterTree })
    mockUsers([])

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )

    expect(res.body.content.groups[0].properties[0]).toEqual(property)
  })

  it('returns 500 when the upstream payload does not match the schema', async () => {
    const broken = {
      ...costCenterTree,
      groups: [{ ...costCenterTree.groups[0], code: undefined }],
    } as unknown as PropertyTree
    jest
      .spyOn(propertyBaseAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({ ok: true, data: broken })
    mockUsers([])

    const res = await request(app.callback()).get(
      `/property-tree?groupBy=costCenter&rootId=${TREE_ID}`
    )

    expect(res.status).toBe(500)
  })
})

describe('GET /market-areas', () => {
  it('returns 200 with the market areas', async () => {
    const data = [
      { id: '1', code: 'MO1', name: 'Centrum' },
      { id: '2', code: 'MO2', name: null },
    ]
    jest
      .spyOn(propertyBaseAdapter, 'listMarketAreas')
      .mockResolvedValueOnce({ ok: true, data })

    const res = await request(app.callback()).get('/market-areas')
    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(data)
  })

  it('returns 500 when the adapter fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'listMarketAreas')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get('/market-areas')
    expect(res.status).toBe(500)
  })
})
