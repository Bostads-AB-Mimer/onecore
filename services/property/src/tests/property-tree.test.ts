import request from 'supertest'

import app from '../app'
import * as groupingAdapter from '../adapters/property-grouping-adapter'
import type { PropertyTree } from '../types/property-tree'

afterEach(() => {
  jest.restoreAllMocks()
})

const UUID = '11111111-1111-1111-1111-111111111111'

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

const tree: PropertyTree = {
  grouping: 'costCenter',
  id: UUID,
  code: '61110',
  name: 'Mimer Mitt',
  groups: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      code: 'KVV-1',
      name: 'Område 1',
      responsibleKeycloakUserId: 'responsible-user-id',
      properties: [property],
    },
  ],
}

describe('GET /property-tree', () => {
  it('returns 400 when rootId is missing', async () => {
    const res = await request(app.callback())
      .get('/property-tree')
      .query({ groupBy: 'costCenter' })

    expect(res.status).toBe(400)
    // parseRequest's shape, not the route's: { status, data: [{ message, path }] }.
    expect(res.body.status).toBe('error with request query')
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['rootId'] })])
    )
  })

  it('returns 400 when groupBy is not a known grouping', async () => {
    const res = await request(app.callback())
      .get('/property-tree')
      .query({ groupBy: 'district', rootId: UUID })

    expect(res.status).toBe(400)
  })

  it('returns 404 when the root does not exist', async () => {
    jest.spyOn(groupingAdapter, 'getPropertyTree').mockResolvedValueOnce(null)

    const res = await request(app.callback())
      .get('/property-tree')
      .query({ groupBy: 'costCenter', rootId: UUID })

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Root not found')
  })

  it('returns the tree, keeping the raw responsible id for core to expand', async () => {
    const spy = jest
      .spyOn(groupingAdapter, 'getPropertyTree')
      .mockResolvedValueOnce(tree)

    const res = await request(app.callback())
      .get('/property-tree')
      .query({ groupBy: 'costCenter', rootId: UUID })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(tree)
    expect(res.body.content.groups[0].responsibleKeycloakUserId).toBe(
      'responsible-user-id'
    )
    expect(spy).toHaveBeenCalledWith('costCenter', UUID)
  })

  it('serves a market-area root by code', async () => {
    const spy = jest
      .spyOn(groupingAdapter, 'getPropertyTree')
      .mockResolvedValueOnce({
        ...tree,
        grouping: 'marketArea',
        id: 'MO1',
        code: 'MO1',
        groups: [
          {
            id: 'MO1',
            code: 'MO1',
            name: 'Centrum',
            responsibleKeycloakUserId: null,
            properties: [property],
          },
        ],
      })

    const res = await request(app.callback())
      .get('/property-tree')
      .query({ groupBy: 'marketArea', rootId: 'MO1' })

    expect(res.status).toBe(200)
    expect(res.body.content.groups[0].responsibleKeycloakUserId).toBeNull()
    expect(spy).toHaveBeenCalledWith('marketArea', 'MO1')
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(groupingAdapter, 'getPropertyTree')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.callback())
      .get('/property-tree')
      .query({ groupBy: 'costCenter', rootId: UUID })

    expect(res.status).toBe(500)
    // The adapter's message must not reach the client — it can carry SQL and
    // table names. Asserted both ways so the leak can't come back unnoticed.
    expect(res.body.reason).toBe('Internal server error')
    expect(JSON.stringify(res.body)).not.toContain('boom')
  })
})

describe('GET /market-areas', () => {
  it('returns the market areas', async () => {
    const rows = [
      { id: '1', code: 'MO1', name: 'Centrum' },
      { id: '2', code: 'MO2', name: null },
    ]
    jest.spyOn(groupingAdapter, 'listMarketAreas').mockResolvedValueOnce(rows)

    const res = await request(app.callback()).get('/market-areas')
    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(rows)
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(groupingAdapter, 'listMarketAreas')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.callback()).get('/market-areas')
    expect(res.status).toBe(500)
    expect(res.body.reason).toBe('Internal server error')
    expect(JSON.stringify(res.body)).not.toContain('boom')
  })
})
