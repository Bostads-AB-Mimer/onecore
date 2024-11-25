import axios from 'axios'
import app from '../app'
const TEST_PORT = 5051
const API_BASE = `http://localhost:${TEST_PORT}`
let server: any

describe('API Navigation Tests', () => {
  beforeAll(async () => {
    server = app.listen(TEST_PORT)
  })

  afterAll(async () => {
    server.close()
  })

  it('should get properties list filtered by tract', async () => {
    const testTract = 'BÄVERN'
    const propertiesResponse = await axios.get(
      `${API_BASE}/properties/?tract=${testTract}`,
    )
    expect(propertiesResponse.status).toBe(200)
    expect(propertiesResponse.data.content).toBeDefined()
    expect(Array.isArray(propertiesResponse.data.content)).toBe(true)
    expect(propertiesResponse.data.content.length).toBeGreaterThan(0)

    // Check that _links are present in the response
    expect(propertiesResponse.data._links).toBeDefined()
    expect(propertiesResponse.data._links.self).toBeDefined()
    expect(propertiesResponse.data._links.self.href).toBeDefined()

    // Verify property structure
    const property = propertiesResponse.data.content[0]
    expect(property.propertyId).toBeDefined()
    expect(property.propertyCode).toBeDefined()
    expect(property.tract).toBe(testTract)
  })

  it('should get detailed property information by ID', async () => {
    const testTract = 'BÄVERN'
    const propertiesResponse = await axios.get(
      `${API_BASE}/properties/?tract=${testTract}`,
    )
    const property = propertiesResponse.data.content[0]
    
    const propertyDetailsResponse = await axios.get(
      `${API_BASE}/properties/${property.propertyId}/`,
    )
    expect(propertyDetailsResponse.status).toBe(200)
    expect(propertyDetailsResponse.data.content).toBeDefined()

    // Verify property details structure
    const propertyDetails = propertyDetailsResponse.data.content
    expect(propertyDetails.propertyId).toBe(property.propertyId)
    expect(propertyDetails.propertyCode).toBe(property.propertyCode)
    expect(propertyDetails.tract).toBe(testTract)

    // Verify HATEOAS links are present
    expect(propertyDetailsResponse.data._links).toBeDefined()
    expect(propertyDetailsResponse.data._links.self).toBeDefined()
    expect(propertyDetailsResponse.data._links.self.href).toBeDefined()
  })

  it('should get buildings associated with a property', async () => {
    const testTract = 'BÄVERN'
    const propertiesResponse = await axios.get(
      `${API_BASE}/properties/?tract=${testTract}`,
    )
    const property = propertiesResponse.data.content[0]
    
    const propertyDetailsResponse = await axios.get(
      `${API_BASE}/properties/${property.propertyId}/`,
    )
    const propertyDetails = propertyDetailsResponse.data.content

    if (propertyDetails.propertyCode) {
      const buildingsLink = `/buildings/${propertyDetails.propertyCode}/`
      const buildingsResponse = await axios.get(`${API_BASE}${buildingsLink}`)
      expect(buildingsResponse.status).toBe(200)
      expect(buildingsResponse.data.content).toBeDefined()
    }
  })
})
