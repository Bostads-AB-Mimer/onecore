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

describe('GET /kvv-areas/resolve', () => {
  it('resolves by rental id', async () => {
    const spy = jest
      .spyOn(kvvAreaAdapter, 'resolveKvvArea')
      .mockResolvedValue(lookupResult())

    const res = await request(app.callback()).get(
      '/kvv-areas/resolve?rentalId=307-048-01-0201'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(lookupResult())
    expect(spy).toHaveBeenCalledWith({ rentalId: '307-048-01-0201' })
  })

  it('resolves by building code', async () => {
    const spy = jest
      .spyOn(kvvAreaAdapter, 'resolveKvvArea')
      .mockResolvedValue(lookupResult())

    const res = await request(app.callback()).get(
      '/kvv-areas/resolve?buildingCode=307-048'
    )

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith({ buildingCode: '307-048' })
  })

  it('returns 400 when no key is given', async () => {
    const spy = jest.spyOn(kvvAreaAdapter, 'resolveKvvArea')

    const res = await request(app.callback()).get('/kvv-areas/resolve')

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns 400 when more than one key is given', async () => {
    const spy = jest.spyOn(kvvAreaAdapter, 'resolveKvvArea')

    const res = await request(app.callback()).get(
      '/kvv-areas/resolve?propertyCode=06601&buildingCode=307-048'
    )

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns 404 when nothing resolves', async () => {
    jest.spyOn(kvvAreaAdapter, 'resolveKvvArea').mockResolvedValue(null)

    const res = await request(app.callback()).get(
      '/kvv-areas/resolve?rentalId=nope'
    )

    expect(res.status).toBe(404)
    expect(res.body.code).toBe('KVV_AREA_NOT_FOUND')
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'resolveKvvArea')
      .mockRejectedValue(new Error('boom'))

    const res = await request(app.callback()).get(
      '/kvv-areas/resolve?propertyCode=06601'
    )

    expect(res.status).toBe(500)
  })
})
