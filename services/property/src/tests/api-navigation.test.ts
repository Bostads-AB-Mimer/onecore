import request from 'supertest'
import app from '../app'

const getResponseContent = async (url: string, query = {}) => {
  const response = await request(app.callback()).get(url).query(query)
  expect(response.status).toBe(200)
  expect(response.body.content).toBeDefined()
  expect(Array.isArray(response.body.content)).toBe(true)
  expect(response.body.content.length).toBeGreaterThan(0)
  return response.body.content
}

describe('API Navigation Tests', () => {
  it('should get companies', async () => {
    const companies = await getResponseContent('/companies/')
    const company = companies[0]
    expect(company.id).toBeDefined()
    expect(company.propertyObjectId).toBeDefined()
    expect(company.code).toBeDefined()
    expect(company.name).toBeDefined()
    expect(company.organizationNumber).toBeDefined()
  })

  it('should get properties list filtered by tract', async () => {
    const testCompany = '001'
    const properties = await getResponseContent('/properties', {
      companyCode: testCompany,
    })

    const property = properties[0]
    expect(property.propertyId).toBeDefined()
    expect(property.code).toBeDefined()
  })

  it('should get detailed property information by ID', async () => {
    const testCompanyId = '001'
    const properties = await getResponseContent('/properties', {
      companyCode: testCompanyId,
    })

    const property = properties[0]
    const propertyDetailsResponse = await request(app.callback()).get(
      `/properties/${property.propertyId}/`
    )

    expect(propertyDetailsResponse.status).toBe(200)
    expect(propertyDetailsResponse.body.content).toBeDefined()

    const propertyDetails = propertyDetailsResponse.body.content
    expect(propertyDetails.propertyObjectId.trim()).toBe(
      property.propertyId.trim()
    )
    expect(propertyDetails.code).toBe(property.code)
  })

  it('should get buildings associated with a property', async () => {
    const testCompany = '001'
    const testTract = 'BÄVERN'
    const properties = await getResponseContent('/properties', {
      companyCode: testCompany,
      tract: testTract,
    })

    const property = properties[0]
    const propertyDetailsResponse = await request(app.callback()).get(
      `/properties/${property.propertyId}/`
    )

    const propertyDetails = propertyDetailsResponse.body.content

    if (propertyDetails.code) {
      const buildings = await getResponseContent('/buildings', {
        propertyCode: propertyDetails.code,
      })
      expect(buildings).toBeDefined()
    }
  })

  it('should get residences associated with a property', async () => {
    const testCompany = '001'
    const testTract = 'BÄVERN'
    const properties = await getResponseContent('/properties', {
      companyCode: testCompany,
      tract: testTract,
    })

    const property = properties[0]
    const propertyDetailsResponse = await request(app.callback()).get(
      `/properties/${property.propertyId}/`
    )

    const propertyDetails = propertyDetailsResponse.body.content
    const buildings = await getResponseContent('/buildings', {
      propertyCode: propertyDetails.code,
    })

    const building = buildings[0]
    const residences = await getResponseContent('/residences', {
      buildingCode: building.buildingCode || building.code,
    })

    if (residences.length > 0) {
      const residence = residences[0]
      expect(residence.id).toBeDefined()
      expect(residence.code).toBeDefined()
      expect(residence.name).toBeDefined()
    }
  })
})
