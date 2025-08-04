import request from 'supertest'
import app from '../app'

describe('Construction parts API', () => {
  let buildingCode: string

  beforeAll(async () => {
    // Get a building code to use in tests
    const buildingsResponse = await request(app.callback())
      .get('/buildings')
      .query({ propertyCode: '01901' })
    buildingCode = buildingsResponse.body.content[0].code
  })

  it('should return construction parts for a building', async () => {
    const response = await request(app.callback())
      .get('/construction-parts')
      .query({ buildingCode })

    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()
    expect(Array.isArray(response.body.content)).toBe(true)
    expect(response.body.content.length).toBeGreaterThan(0)

    const constructionPart = response.body.content[0]
    expect(constructionPart.id).toBeDefined()
    expect(constructionPart.propertyObjectId).toBeDefined()
    expect(constructionPart.code).toBeDefined()
    expect(constructionPart.name).toBeDefined()
    expect(constructionPart.name).toBeDefined()
    expect(constructionPart._links).toBeDefined()
    expect(constructionPart._links.self.href).toEqual('NOT_IMPLEMENTED')
    expect(constructionPart._links.parent.href).toEqual('NOT_IMPLEMENTED')
    expect(constructionPart._links.building.href).toEqual('NOT_IMPLEMENTED')
    expect(constructionPart._links.residences.href).toEqual('NOT_IMPLEMENTED')
  })

  it('should validate buildingCode parameter', async () => {
    const response = await request(app.callback())
      .get('/construction-parts')
      .query({ buildingCode: 'short' }) // Too short building code

    expect(response.status).toBe(400)
    expect(response.body.errors).toBeDefined()
  })
})
