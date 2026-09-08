import request from 'supertest'

import app from '../app'
import * as kvvAreaAdapter from '../adapters/kvv-area-adapter'

afterEach(() => {
  jest.restoreAllMocks()
})

const KVV_AREA_ID = '11111111-1111-1111-1111-111111111111'
const COST_CENTER_ID = '33333333-3333-3333-3333-333333333333'

const lookupResult = () => ({
  kvvArea: { id: KVV_AREA_ID, code: '61141', name: 'Distrikt Väst: SKÄLBY' },
  costCenter: { id: COST_CENTER_ID, code: '61140', name: 'Distrikt Väst' },
  responsibleKeycloakUserId: 'kc-user-1',
})

describe('GET /properties/:code/kvv-area', () => {
  it('returns 200 with kvv-area, cost center and responsible for a linked property', async () => {
    const spy = jest
      .spyOn(kvvAreaAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValue(lookupResult())

    const res = await request(app.callback()).get('/properties/01801/kvv-area')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(lookupResult())
    expect(spy).toHaveBeenCalledWith('01801')
  })

  it('returns 404 when the property has no kvv-area link', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'getKvvAreaByPropertyCode')
      .mockResolvedValue(null)

    const res = await request(app.callback()).get('/properties/nolink/kvv-area')

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Property has no KVV-area')
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'getKvvAreaByPropertyCode')
      .mockRejectedValue(new Error('boom'))

    const res = await request(app.callback()).get('/properties/01801/kvv-area')

    expect(res.status).toBe(500)
  })
})
