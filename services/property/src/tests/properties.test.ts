import request from 'supertest'
import app from '../app'
import * as kvvAreaAdapter from '../adapters/kvv-area-adapter'

describe('Properties API', () => {
  const testCompany = '001'
  const testTract = 'BÄVERN'

  it('should return properties for a company', async () => {
    const response = await request(app.callback())
      .get('/properties')
      .query({ companyCode: testCompany })

    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()
    expect(Array.isArray(response.body.content)).toBe(true)
    expect(response.body.content.length).toBeGreaterThan(0)

    const property = response.body.content[0]
    expect(property.id).toBeDefined()
    expect(property.code).toBeDefined()
    expect(property.propertyDesignationId).toBeDefined()
    expect(property._links).toBeDefined()
    expect(property._links.self).toBeDefined()
    expect(property._links.buildings).toBeDefined()
  })

  it('should filter properties by tract', async () => {
    const response = await request(app.callback())
      .get('/properties')
      .query({ companyCode: testCompany, tract: testTract })

    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()
    expect(Array.isArray(response.body.content)).toBe(true)
    expect(response.body.content.length).toBeGreaterThan(0)

    const property = response.body.content[0]
    expect(property.tract).toContain(testTract)
  })

  it('should return property details by ID', async () => {
    // First get a property ID from the list
    const propertiesResponse = await request(app.callback())
      .get('/properties')
      .query({ companyCode: testCompany })

    const propertyId = propertiesResponse.body.content[0].id
    expect(propertiesResponse.status).toBe(200)

    const response = await request(app.callback()).get(
      `/properties/${propertyId}`
    )
    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()

    const property = response.body.content
    expect(property.id).toBeDefined()
    expect(property.code).toBeDefined()
    expect(property._links).toBeDefined()
    expect(property._links.self).toBeDefined()
    expect(property._links.buildings).toBeDefined()
  })

  it('should return 404 for non-existent property ID', async () => {
    const response = await request(app.callback()).get(
      '/properties/nonexistent'
    )
    expect(response.status).toBe(404)
  })
})

describe('PUT /properties/:code/kvv-area', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  const validKvvAreaId = '11111111-1111-1111-1111-111111111111'

  it('returns 200 with the upserted link on success', async () => {
    const spy = jest
      .spyOn(kvvAreaAdapter, 'upsertPropertyKvvArea')
      .mockResolvedValue({
        ok: true,
        data: {
          propertyCode: 'P1',
          kvvAreaId: validKvvAreaId,
          updatedAt: '2026-06-01T10:00:00.000Z',
          updatedBy: 'alice',
        },
      })

    const res = await request(app.callback())
      .put('/properties/P1/kvv-area')
      .send({ kvvAreaId: validKvvAreaId, updatedBy: 'alice' })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      propertyCode: 'P1',
      kvvAreaId: validKvvAreaId,
      updatedAt: '2026-06-01T10:00:00.000Z',
      updatedBy: 'alice',
    })
    expect(spy).toHaveBeenCalledWith({
      propertyCode: 'P1',
      kvvAreaId: validKvvAreaId,
      updatedBy: 'alice',
    })
  })

  it('returns 404 when the kvv-area does not exist', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'upsertPropertyKvvArea')
      .mockResolvedValue({ ok: false, err: 'kvv-area-not-found' })

    const res = await request(app.callback())
      .put('/properties/P1/kvv-area')
      .send({ kvvAreaId: validKvvAreaId })

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('KVV-area not found')
    expect(res.body.code).toBe('KVV_AREA_NOT_FOUND')
  })

  it('returns 404 when the property does not exist', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'upsertPropertyKvvArea')
      .mockResolvedValue({ ok: false, err: 'property-not-found' })

    const res = await request(app.callback())
      .put('/properties/missing/kvv-area')
      .send({ kvvAreaId: validKvvAreaId })

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Property not found')
    expect(res.body.code).toBe('PROPERTY_NOT_FOUND')
  })

  it('returns 400 when kvvAreaId is not a uuid', async () => {
    const res = await request(app.callback())
      .put('/properties/P1/kvv-area')
      .send({ kvvAreaId: 'not-a-uuid' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when kvvAreaId is missing', async () => {
    const res = await request(app.callback())
      .put('/properties/P1/kvv-area')
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 500 when the adapter returns unknown error', async () => {
    jest
      .spyOn(kvvAreaAdapter, 'upsertPropertyKvvArea')
      .mockResolvedValue({ ok: false, err: 'unknown' })

    const res = await request(app.callback())
      .put('/properties/P1/kvv-area')
      .send({ kvvAreaId: validKvvAreaId })

    expect(res.status).toBe(500)
  })
})
