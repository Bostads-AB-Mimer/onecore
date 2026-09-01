import request from 'supertest'

import app from '../app'
import * as groupingAdapter from '../adapters/property-grouping-adapter'
import * as rentalObjectAdapter from '../adapters/rental-object-adapter'
import * as subtypeAdapter from '../adapters/rental-object-subtype-adapter'
import type {
  RentalObjectDetails,
  RentalObjectSubtype,
  RentalObjectSummary,
} from '../types/rental-object'

afterEach(() => {
  jest.restoreAllMocks()
})

const UUID = '11111111-1111-1111-1111-111111111111'

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
    expect(res.body.data[0].message).toBe(
      'Provide exactly one of propertyCode or buildingCode.'
    )
  })

  it('returns 400 when both propertyCode and buildingCode are given', async () => {
    const res = await request(app.callback())
      .get('/rental-objects')
      .query({ propertyCode: '04101', buildingCode: '04101-B1' })

    expect(res.status).toBe(400)
  })

  it('returns the objects of one property', async () => {
    const spy = jest
      .spyOn(rentalObjectAdapter, 'getRentalObjects')
      .mockResolvedValueOnce([summary])

    const res = await request(app.callback())
      .get('/rental-objects')
      .query({ propertyCode: '04101', exclude: 'parkingSpace' })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([summary])
    expect(spy).toHaveBeenCalledWith({
      propertyCode: '04101',
      buildingCode: undefined,
      exclude: ['parkingSpace'],
    })
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(rentalObjectAdapter, 'getRentalObjects')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.callback())
      .get('/rental-objects')
      .query({ propertyCode: '04101' })

    expect(res.status).toBe(500)
  })
})

describe('GET /rental-objects/search', () => {
  const mockSearch = (rows = [summary], totalCount = rows.length) =>
    jest
      .spyOn(rentalObjectAdapter, 'searchRentalObjects')
      .mockResolvedValueOnce({ rows, totalCount })

  it('returns 400 when no scope is given', async () => {
    const res = await request(app.callback())
      .get('/rental-objects/search')
      .query({ types: 'residence' })

    expect(res.status).toBe(400)
    expect(res.body.data[0].message).toBe(
      'Provide at least one scope to search within.'
    )
  })

  it('returns 400 when a cost centre id is not a uuid', async () => {
    const res = await request(app.callback())
      .get('/rental-objects/search')
      .query({ costCenterIds: 'not-a-uuid' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when more than 200 rental ids are given', async () => {
    const rentalIds = Array.from({ length: 201 }, (_, i) => `id-${i}`)

    const res = await request(app.callback())
      .get('/rental-objects/search')
      .query({ rentalIds })

    expect(res.status).toBe(400)
  })

  it('accepts exactly 200 rental ids', async () => {
    jest
      .spyOn(groupingAdapter, 'resolveSearchPropertyCodes')
      .mockResolvedValueOnce([])
    mockSearch([])

    const res = await request(app.callback())
      .get('/rental-objects/search')
      .query({ rentalIds: Array.from({ length: 200 }, (_, i) => `id-${i}`) })

    expect(res.status).toBe(200)
  })

  it('resolves grouping scopes to property codes before searching', async () => {
    const resolve = jest
      .spyOn(groupingAdapter, 'resolveSearchPropertyCodes')
      .mockResolvedValueOnce(['04101', '04102'])
    const search = mockSearch([summary], 137)

    const res = await request(app.callback())
      .get('/rental-objects/search')
      .query({ costCenterIds: UUID, buildingCodes: '04101-B1' })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([summary])
    expect(res.body.totalCount).toBe(137)
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        costCenterIds: [UUID],
        buildingCodes: ['04101-B1'],
      })
    )
    // The resolved codes ride alongside the raw params, not instead of them:
    // buildings and trapphus stay scopes of their own.
    expect(search).toHaveBeenCalledWith(expect.anything(), ['04101', '04102'])
  })

  it('defaults to the first page of 50', async () => {
    jest
      .spyOn(groupingAdapter, 'resolveSearchPropertyCodes')
      .mockResolvedValueOnce([])
    const search = mockSearch()

    await request(app.callback())
      .get('/rental-objects/search')
      .query({ propertyCodes: '04101' })

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50 }),
      expect.anything()
    )
  })

  it('returns 400 when limit exceeds the cap', async () => {
    const res = await request(app.callback())
      .get('/rental-objects/search')
      .query({ propertyCodes: '04101', limit: 501 })

    expect(res.status).toBe(400)
  })

  it('returns 400 when a type is not a known object type', async () => {
    const res = await request(app.callback())
      .get('/rental-objects/search')
      .query({ propertyCodes: '04101', types: 'garage' })

    expect(res.status).toBe(400)
  })

  it('forwards the type, subtype and free-text filters', async () => {
    jest
      .spyOn(groupingAdapter, 'resolveSearchPropertyCodes')
      .mockResolvedValueOnce([])
    const search = mockSearch()

    await request(app.callback())
      .get('/rental-objects/search')
      .query({
        propertyCodes: '04101',
        types: ['residence', 'facility'],
        subtypes: 'residence:12',
        q: 'josef',
      })

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        types: ['residence', 'facility'],
        subtypes: ['residence:12'],
        q: 'josef',
      }),
      expect.anything()
    )
  })

  it('returns 500 when scope resolution throws', async () => {
    jest
      .spyOn(groupingAdapter, 'resolveSearchPropertyCodes')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.callback())
      .get('/rental-objects/search')
      .query({ propertyCodes: '04101' })

    expect(res.status).toBe(500)
    expect(res.body.reason).toBe('Internal server error')
  })
})

describe('GET /rental-objects/details', () => {
  it('returns 400 when no scope is given', async () => {
    const res = await request(app.callback()).get('/rental-objects/details')
    expect(res.status).toBe(400)
    expect(res.body.data[0].message).toBe(
      'Provide at least one scope to search within.'
    )
  })

  it('resolves every scope level to property codes before looking details up', async () => {
    const resolve = jest
      .spyOn(groupingAdapter, 'resolveDetailsPropertyCodes')
      .mockResolvedValueOnce(['04101'])
    const build = jest
      .spyOn(rentalObjectAdapter, 'buildRentalObjectDetails')
      .mockResolvedValueOnce([details])

    const res = await request(app.callback())
      .get('/rental-objects/details')
      .query({ staircaseCodes: '04101-B1-01' })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([details])
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ staircaseCodes: ['04101-B1-01'] })
    )
    expect(build).toHaveBeenCalledWith(['04101'])
  })

  it('returns 500 when the lookup throws', async () => {
    jest
      .spyOn(groupingAdapter, 'resolveDetailsPropertyCodes')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.callback())
      .get('/rental-objects/details')
      .query({ propertyCodes: '04101' })

    expect(res.status).toBe(500)
  })
})

describe('GET /rental-object-subtypes', () => {
  it('returns the subtypes in use', async () => {
    jest
      .spyOn(subtypeAdapter, 'listRentalObjectSubtypes')
      .mockResolvedValueOnce([subtype])

    const res = await request(app.callback()).get('/rental-object-subtypes')
    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([subtype])
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(subtypeAdapter, 'listRentalObjectSubtypes')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.callback()).get('/rental-object-subtypes')
    expect(res.status).toBe(500)
  })
})
