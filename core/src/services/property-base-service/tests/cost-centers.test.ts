import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes as costCenterRoutes } from '../cost-centers'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as keycloakAdapter from '../../auth-service/keycloak-admin-adapter'

const app = new Koa()
const router = new KoaRouter()
costCenterRoutes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

const TREE_ID = '11111111-1111-1111-1111-111111111111'
const LEAD_ID = 'lead-user-id'
const DEPUTY_ID = 'deputy-user-id'
const RESP_ID = 'responsible-user-id'

const baseTree = {
  id: TREE_ID,
  code: '61110',
  name: 'Mimer Mitt',
  leadKeycloakUserId: LEAD_ID,
  deputyKeycloakUserId: DEPUTY_ID,
  kvvAreas: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      code: 'KVV-1',
      name: 'Område 1',
      responsibleKeycloakUserId: RESP_ID,
      properties: [
        {
          code: '04101',
          designation: 'JOSEF 7',
          tract: 'Josef',
          addresses: [
            {
              buildingCode: '04101-B1',
              buildingName: 'Hus 1',
              address: 'Hus 1',
            },
          ],
          aggregates: { residenceCount: 26, parkingCount: 0, entranceCount: 5 },
        },
      ],
    },
  ],
}

describe('GET /cost-centers/:id/tree', () => {
  it('returns 404 when cost center is missing', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getCostCenterTreeById')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback()).get(
      `/cost-centers/${TREE_ID}/tree`
    )
    expect(res.status).toBe(404)
  })

  it('returns 500 when the adapter fails with unknown', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getCostCenterTreeById')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get(
      `/cost-centers/${TREE_ID}/tree`
    )
    expect(res.status).toBe(500)
  })

  it('returns a hydrated tree when keycloak resolves', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getCostCenterTreeById')
      .mockResolvedValueOnce({ ok: true, data: baseTree })

    jest.spyOn(keycloakAdapter, 'getUsersByRole').mockResolvedValueOnce({
      ok: true,
      data: [
        { id: LEAD_ID, username: 'lead', firstName: 'L', lastName: 'Ead' },
        { id: DEPUTY_ID, username: 'deputy' },
        { id: RESP_ID, username: 'resp' },
      ],
    })

    const res = await request(app.callback()).get(
      `/cost-centers/${TREE_ID}/tree`
    )
    expect(res.status).toBe(200)
    expect(res.body.content.lead).toMatchObject({
      id: LEAD_ID,
      username: 'lead',
    })
    expect(res.body.content.deputy).toMatchObject({ id: DEPUTY_ID })
    expect(res.body.content.kvvAreas[0].responsible).toMatchObject({
      id: RESP_ID,
    })
  })

  it('returns the tree with null users when keycloak fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getCostCenterTreeById')
      .mockResolvedValueOnce({ ok: true, data: baseTree })

    jest.spyOn(keycloakAdapter, 'getUsersByRole').mockResolvedValueOnce({
      ok: false,
      err: 'keycloak_unreachable',
      statusCode: 502,
    })

    const res = await request(app.callback()).get(
      `/cost-centers/${TREE_ID}/tree`
    )
    expect(res.status).toBe(200)
    expect(res.body.content.lead).toBeNull()
    expect(res.body.content.deputy).toBeNull()
    expect(res.body.content.kvvAreas[0].responsible).toBeNull()
  })

  it('returns null users for ids not found in the role list', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getCostCenterTreeById')
      .mockResolvedValueOnce({ ok: true, data: baseTree })

    jest.spyOn(keycloakAdapter, 'getUsersByRole').mockResolvedValueOnce({
      ok: true,
      data: [{ id: LEAD_ID, username: 'lead' }],
    })

    const res = await request(app.callback()).get(
      `/cost-centers/${TREE_ID}/tree`
    )
    expect(res.status).toBe(200)
    expect(res.body.content.lead).not.toBeNull()
    expect(res.body.content.deputy).toBeNull()
    expect(res.body.content.kvvAreas[0].responsible).toBeNull()
  })
})

describe('GET /cost-centers', () => {
  it('returns 200 with the list of cost centers', async () => {
    const data = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        code: '61110',
        name: 'Mimer Mitt',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        code: '61120',
        name: 'Mimer Väst',
      },
    ]
    jest
      .spyOn(propertyBaseAdapter, 'listCostCenters')
      .mockResolvedValueOnce({ ok: true, data })

    const res = await request(app.callback()).get('/cost-centers')
    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(data)
  })

  it('returns 500 when the adapter fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'listCostCenters')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get('/cost-centers')
    expect(res.status).toBe(500)
  })
})
