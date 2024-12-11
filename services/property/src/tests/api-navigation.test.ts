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

  it('should get companies', async () => {
    const companyResponse = await axios.get(`${API_BASE}/companies/`)
    expect(companyResponse.status).toBe(200)
    expect(companyResponse.data.content).toBeDefined()
    expect(Array.isArray(companyResponse.data.content)).toBe(true)
    expect(companyResponse.data.content.length).toBeGreaterThan(0)

    // Check that _links are present in the response
    expect(companyResponse.data._links).toBeDefined()
    expect(companyResponse.data._links.self).toBeDefined()
    expect(companyResponse.data._links.self.href).toBeDefined()

    // Verify company structure
    const company = companyResponse.data.content[0]
    expect(company.id).toBeDefined()
    expect(company.propertyObjectId).toBeDefined()
    expect(company.code).toBeDefined()
    expect(company.name).toBeDefined()
    expect(company.organizationNumber).toBeDefined()
  })

  it('should get properties list filtered by tract', async () => {
    const testCompany = '001'
    const testTract = 'BÄVERN'
    const propertiesResponse = await axios.get(
      `${API_BASE}/properties?companyCode=${testCompany}&tract=${testTract}`
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
    expect(property.code).toBeDefined()
    expect(property.name).toContain(testTract)
  })

  it('should get detailed property information by ID', async () => {
    const testCompanyId = '001'
    const propertiesResponse = await axios.get(
      `${API_BASE}/properties?companyCode=${testCompanyId}`
    )
    const property = propertiesResponse.data.content[0]
    const propertyDetailsResponse = await axios.get(
      `${API_BASE}/properties/${property.propertyId}/`
    )
    expect(propertyDetailsResponse.status).toBe(200)
    expect(propertyDetailsResponse.data.content).toBeDefined()

    // Verify property details structure
    const propertyDetails = propertyDetailsResponse.data.content
    expect(propertyDetails.propertyObjectId).toBe(property.propertyId)
    expect(propertyDetails.code).toBe(property.code)

    // Verify HATEOAS links are present
    expect(propertyDetailsResponse.data._links).toBeDefined()
    expect(propertyDetailsResponse.data._links.self).toBeDefined()
    expect(propertyDetailsResponse.data._links.self.href).toBeDefined()
  })

  it('should get buildings associated with a property', async () => {
    const testCompany = '001'
    const testTract = 'BÄVERN'
    const propertiesResponse = await axios.get(
      `${API_BASE}/properties?companyCode=${testCompany}&tract=${testTract}`
    )
    const property = propertiesResponse.data.content[0]

    const propertyDetailsResponse = await axios.get(
      `${API_BASE}/properties/${property.propertyId}/`
    )
    const propertyDetails = propertyDetailsResponse.data.content

    if (propertyDetails.code) {
      const buildingsLink = `/buildings?propertyCode=${propertyDetails.code}/`
      const buildingsResponse = await axios.get(`${API_BASE}${buildingsLink}`)
      expect(buildingsResponse.status).toBe(200)
      expect(buildingsResponse.data.content).toBeDefined()
    }
  })

  //todo: add test for staircases before residence test

  it('should get residences associated with a property', async () => {
    const testCompany = '001'
    const testTract = 'BÄVERN'
    const propertiesResponse = await axios.get(
      `${API_BASE}/properties/?companyCode=${testCompany}&tract=${testTract}`
    )
    const property = propertiesResponse.data.content[0]

    const propertyDetailsResponse = await axios.get(
      `${API_BASE}/properties/${property.propertyId}/`
    )
    const propertyDetails = propertyDetailsResponse.data.content

    const buildingsResponse = await axios.get(
      `${API_BASE}/buildings?propertyCode=${propertyDetails.code}`
    )

    const building = buildingsResponse.data.content[0]
    // Then get residences for the first property
    const residencesResponse = await axios.get(
      `${API_BASE}/residences?buildingCode=${building.code}`
    )
    expect(residencesResponse.status).toBe(200)
    expect(residencesResponse.data.content).toBeDefined()
    expect(Array.isArray(residencesResponse.data.content)).toBe(true)

    // Verify residence structure if any exist
    if (residencesResponse.data.content.length > 0) {
      const residence = residencesResponse.data.content[0]
      expect(residence.id).toBeDefined()
      expect(residence.code).toBeDefined()
      expect(residence.name).toBeDefined()
      expect(residence.links).toBeDefined()
      expect(residence.links.property).toBe(property.propertyCode)
    }
  })
})
