import request from 'supertest'
import app from '../app'

describe('Buildings API', () => {
  let propertyCode: string

  beforeAll(async () => {
    // Get a property code to use in tests
    const propertiesResponse = await request(app.callback())
      .get('/properties')
      .query({ companyCode: '001' })
    propertyCode = propertiesResponse.body.content[0].code
  })

  it('should return buildings for a property', async () => {
    const response = await request(app.callback())
      .get('/buildings')
      .query({ propertyCode })
    
    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()
    expect(Array.isArray(response.body.content)).toBe(true)
    expect(response.body.content.length).toBeGreaterThan(0)

    const building = response.body.content[0]
    expect(building.id).toBeDefined()
    expect(building.code).toBeDefined()
    expect(building.name).toBeDefined()
    expect(building._links).toBeDefined()
    expect(building._links.self).toBeDefined()
    expect(building._links.property).toBeDefined()
    expect(building._links.residences).toBeDefined()
    expect(building._links.staircases).toBeDefined()
  })

  it('should return building details by ID', async () => {
    // First get a building ID from the list
    const buildingsResponse = await request(app.callback())
      .get('/buildings')
      .query({ propertyCode })
    
    const buildingId = buildingsResponse.body.content[0].id

    const response = await request(app.callback()).get(`/buildings/${buildingId}`)
    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()

    const building = response.body.content
    expect(building.id).toBe(buildingId)
    expect(building.code).toBeDefined()
    expect(building.name).toBeDefined()
    expect(building._links).toBeDefined()
  })

  it('should return 404 for non-existent building ID', async () => {
    const response = await request(app.callback()).get('/buildings/nonexistent')
    expect(response.status).toBe(404)
  })
})
