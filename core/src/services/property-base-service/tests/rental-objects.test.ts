import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes as rentalObjectRoutes } from '../rental-objects'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import type { components } from '../../../adapters/property-base-adapter/generated/api-types'

type RentalObjectSummary = components['schemas']['RentalObjectSummary']
type RentalObjectDetails = components['schemas']['RentalObjectDetails']
type RentalObjectSubtype = components['schemas']['RentalObjectSubtype']

const app = new Koa()
const router = new KoaRouter()
rentalObjectRoutes(router)
app.silent = true
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

const summary: RentalObjectSummary = {
  rentalId: '104-041-01-0101',
  type: 'residence',
  code: '1101',
  name: 'Lägenhet 1101',
  subtypeCode: '12',
  subtypeName: '3 rum och kök',
  address: 'Josefsgatan 1',
  buildingCode: '04101-B1',
  staircaseCode: '01',
  staircaseName: 'Hus 1 A',
  parkingAreaCode: null,
  propertyCode: '04101',
  propertyName: 'JOSEF 7',
}

const details: RentalObjectDetails = {
  rentalId: '104-041-01-0101',
  baseRent: 7250,
  area: 72.5,
  additionalInfo: null,
  malarEnergiFacilityId: 'ME-123',
}

const subtype: RentalObjectSubtype = {
  type: 'residence',
  code: '12',
  name: '3 rum och kök',
}

describe('GET /rental-objects', () => {
  it('returns 400 when neither propertyCode nor buildingCode is given', async () => {
    const res = await request(app.callback()).get('/rental-objects')
    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
  })

  it('returns 400 when both propertyCode and buildingCode are given', async () => {
    const res = await request(app.callback()).get(
      '/rental-objects?propertyCode=04101&buildingCode=04101-B1'
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 and forwards the scope and a single exclude as an array', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getRentalObjects')
      .mockResolvedValueOnce({ ok: true, data: [summary] })

    const res = await request(app.callback()).get(
      '/rental-objects?propertyCode=04101&exclude=parkingSpace'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([summary])
    expect(spy).toHaveBeenCalledWith({
      propertyCode: '04101',
      exclude: ['parkingSpace'],
    })
  })

  it('returns 400 when exclude is not a known object type', async () => {
    const res = await request(app.callback()).get(
      '/rental-objects?propertyCode=04101&exclude=garage'
    )
    expect(res.status).toBe(400)
  })

  it('returns 500 when the adapter fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getRentalObjects')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get(
      '/rental-objects?propertyCode=04101'
    )
    expect(res.status).toBe(500)
  })
})

describe('GET /rental-objects/search', () => {
  const okOnce = (rows = [summary], totalCount = 1) =>
    jest
      .spyOn(propertyBaseAdapter, 'searchRentalObjects')
      .mockResolvedValueOnce({ ok: true, data: { content: rows, totalCount } })

  it('returns the rows and the total count', async () => {
    okOnce([summary], 137)

    const res = await request(app.callback()).get(
      '/rental-objects/search?buildingCodes=04101-B1'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([summary])
    expect(res.body.totalCount).toBe(137)
  })

  it('normalises a single scope value into an array', async () => {
    const spy = okOnce()

    await request(app.callback()).get(
      '/rental-objects/search?buildingCodes=04101-B1'
    )

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ buildingCodes: ['04101-B1'] })
    )
  })

  it('keeps every repeated scope value', async () => {
    const spy = okOnce()

    await request(app.callback()).get(
      '/rental-objects/search?costCenterIds=cc1&costCenterIds=cc2&propertyCodes=04101'
    )

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        costCenterIds: ['cc1', 'cc2'],
        propertyCodes: ['04101'],
      })
    )
  })

  it('forwards the type, subtype, free-text and paging filters', async () => {
    const spy = okOnce()

    await request(app.callback()).get(
      '/rental-objects/search?propertyCodes=04101&types=residence&types=facility' +
        '&subtypes=residence%3A12&q=josef&page=3&limit=25'
    )

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        types: ['residence', 'facility'],
        subtypes: ['residence:12'],
        q: 'josef',
        page: 3,
        limit: 25,
      })
    )
  })

  it('returns 400 when a type is not a known object type', async () => {
    const res = await request(app.callback()).get(
      '/rental-objects/search?propertyCodes=04101&types=garage'
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when limit exceeds the cap', async () => {
    const res = await request(app.callback()).get(
      '/rental-objects/search?propertyCodes=04101&limit=501'
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when page is not a positive integer', async () => {
    const res = await request(app.callback()).get(
      '/rental-objects/search?propertyCodes=04101&page=0'
    )
    expect(res.status).toBe(400)
  })

  // Core does not require a scope itself — the property service rejects a
  // scopeless search and core maps that to the same 400.
  it('returns 400 when the property service rejects a scopeless search', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'searchRentalObjects')
      .mockResolvedValueOnce({ ok: false, err: 'bad-request' })

    const res = await request(app.callback()).get('/rental-objects/search')
    expect(res.status).toBe(400)
    expect(res.body.reason).toBe('Provide at least one scope to search within.')
  })

  it('returns 500 when the adapter fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'searchRentalObjects')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get(
      '/rental-objects/search?propertyCodes=04101'
    )
    expect(res.status).toBe(500)
  })

  it('returns 500 when an upstream row does not match the schema', async () => {
    const broken = {
      ...summary,
      rentalId: undefined,
    } as unknown as RentalObjectSummary
    okOnce([broken])

    const res = await request(app.callback()).get(
      '/rental-objects/search?propertyCodes=04101'
    )
    expect(res.status).toBe(500)
  })
})

describe('GET /rental-objects/by-root', () => {
  it('returns 400 when rootId is missing', async () => {
    const res = await request(app.callback()).get(
      '/rental-objects/by-root?groupBy=costCenter'
    )
    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
  })

  it('returns 400 when groupBy is not a known grouping', async () => {
    const res = await request(app.callback()).get(
      '/rental-objects/by-root?groupBy=district&rootId=cc1'
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when the root does not exist', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getRootRentalObjects')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback()).get(
      '/rental-objects/by-root?groupBy=costCenter&rootId=missing'
    )
    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Root not found')
  })

  it('returns the root objects and forwards the pair unchanged', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getRootRentalObjects')
      .mockResolvedValueOnce({ ok: true, data: [summary] })

    const res = await request(app.callback()).get(
      '/rental-objects/by-root?groupBy=marketArea&rootId=MO1'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([summary])
    expect(spy).toHaveBeenCalledWith({ groupBy: 'marketArea', rootId: 'MO1' })
  })

  it('returns 500 when the adapter fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getRootRentalObjects')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get(
      '/rental-objects/by-root?groupBy=costCenter&rootId=cc1'
    )
    expect(res.status).toBe(500)
  })
})

describe('GET /rental-objects/details', () => {
  it('returns 400 when no scope is given', async () => {
    const res = await request(app.callback()).get('/rental-objects/details')
    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
  })

  it('returns the details and normalises a single scope value', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getRentalObjectDetails')
      .mockResolvedValueOnce({ ok: true, data: [details] })

    const res = await request(app.callback()).get(
      '/rental-objects/details?staircaseCodes=04101-B1-01'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([details])
    expect(spy).toHaveBeenCalledWith({ staircaseCodes: ['04101-B1-01'] })
  })

  it('accepts every scope the search accepts', async () => {
    const spy = jest
      .spyOn(propertyBaseAdapter, 'getRentalObjectDetails')
      .mockResolvedValueOnce({ ok: true, data: [] })

    await request(app.callback()).get(
      '/rental-objects/details?costCenterIds=cc1&kvvAreaIds=kvv1&marketAreaCodes=MO1' +
        '&propertyCodes=04101&buildingCodes=04101-B1&staircaseCodes=04101-B1-01' +
        '&parkingAreaCodes=041-717-00&rentalIds=104-041-01-0101'
    )

    expect(spy).toHaveBeenCalledWith({
      costCenterIds: ['cc1'],
      kvvAreaIds: ['kvv1'],
      marketAreaCodes: ['MO1'],
      propertyCodes: ['04101'],
      buildingCodes: ['04101-B1'],
      staircaseCodes: ['04101-B1-01'],
      parkingAreaCodes: ['041-717-00'],
      rentalIds: ['104-041-01-0101'],
    })
  })

  it('returns 400 when the property service rejects the scope', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getRentalObjectDetails')
      .mockResolvedValueOnce({ ok: false, err: 'bad-request' })

    const res = await request(app.callback()).get(
      '/rental-objects/details?propertyCodes=04101'
    )
    expect(res.status).toBe(400)
  })

  it('returns 500 when the adapter fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'getRentalObjectDetails')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get(
      '/rental-objects/details?propertyCodes=04101'
    )
    expect(res.status).toBe(500)
  })
})

describe('GET /rental-object-subtypes', () => {
  it('returns 200 with the subtypes', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'listRentalObjectSubtypes')
      .mockResolvedValueOnce({ ok: true, data: [subtype] })

    const res = await request(app.callback()).get('/rental-object-subtypes')
    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([subtype])
  })

  it('returns 500 when the adapter fails', async () => {
    jest
      .spyOn(propertyBaseAdapter, 'listRentalObjectSubtypes')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get('/rental-object-subtypes')
    expect(res.status).toBe(500)
  })
})
