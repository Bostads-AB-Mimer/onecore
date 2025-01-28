import request from 'supertest'
import app from '../app'

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
