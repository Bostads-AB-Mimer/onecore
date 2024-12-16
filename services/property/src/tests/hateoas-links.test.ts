import request from 'supertest'
import app from '../app'

describe('HATEOAS Links Navigation', () => {
  it('should be able to navigate from companies to components using only HATEOAS links', async () => {
    // Start with companies list
    const companiesResponse = await request(app.callback()).get('/companies')
    expect(companiesResponse.status).toBe(200)
    expect(companiesResponse.body.content.length).toBeGreaterThan(0) // Ensure at least one company is present

    const company = companiesResponse.body.content[0]
    expect(company._links.properties).toBeDefined()

    // Follow link to properties
    const propertiesUrl = company._links.properties.href
    const propertiesResponse = await request(app.callback()).get(propertiesUrl)
    expect(propertiesResponse.status).toBe(200)
    expect(propertiesResponse.body.content.length).toBeGreaterThan(0) // Ensure at least one property

    const property = propertiesResponse.body.content[0]
    expect(property._links.buildings).toBeDefined()

    // Follow link to buildings
    const buildingsUrl = property._links.buildings.href
    const buildingsResponse = await request(app.callback()).get(buildingsUrl)
    expect(buildingsResponse.status).toBe(200)
    expect(buildingsResponse.body.content).toHaveLength(3) // Assuming at least one building

    const building = buildingsResponse.body.content[0]
    expect(building._links.staircases).toBeDefined()
    expect(building._links.residences).toBeDefined()

    // Follow link to staircases
    const staircasesUrl = building._links.staircases.href
    const staircasesResponse = await request(app.callback()).get(staircasesUrl)
    expect(staircasesResponse.status).toBe(200)

    // Follow link to residences
    const residencesUrl = building._links.residences.href
    const residencesResponse = await request(app.callback()).get(residencesUrl)
    expect(residencesResponse.status).toBe(200)

    if (
      residencesResponse.body.content &&
      residencesResponse.body.content.length > 0
    ) {
      const residence = residencesResponse.body.content[0]
      expect(residence._links.rooms).toBeDefined()
      /*
      // Follow link to rooms
      const roomsUrl = residence._links.rooms.href
      const roomsResponse = await request(app.callback()).get(roomsUrl)
      expect(roomsResponse.status).toBe(200)

      if (roomsResponse.body.content.length > 0) {
        const room = roomsResponse.body.content[0]
        expect(room._links.self).toBeDefined()
        expect(room._links.residence).toBeDefined()
        expect(room._links.parent).toBeDefined()
      }*/
    }
  })

  it('should be able to navigate back up the hierarchy using parent links', async () => {
    // Start with a known residence
    const testCompany = '001'
    const testTract = 'BÄVERN'

    // Get properties for the test company
    const propertiesResponse = await request(app.callback())
      .get('/properties')
      .query({ companyCode: testCompany, tract: testTract })

    const property = propertiesResponse.body.content[0]

    // Get buildings for the property
    const buildingsResponse = await request(app.callback())
      .get('/buildings')
      .query({ propertyCode: property.code })

    const building = buildingsResponse.body.content[0]

    // Get residences for the building
    const residencesResponse = await request(app.callback())
      .get('/residences')
      .query({ buildingCode: building.code })

    if (
      residencesResponse.body.content &&
      residencesResponse.body.content.length > 0
    ) {
      const residence = residencesResponse.body.content[0]
      expect(residence._links.parent).toBeDefined()

      // Navigate back to building using parent link
      const parentBuildingUrl = residence._links.parent.href
      const parentBuildingResponse = await request(app.callback()).get(
        parentBuildingUrl
      )
      expect(parentBuildingResponse.status).toBe(200)

      const parentBuilding = parentBuildingResponse.body.content
      expect(parentBuilding._links.parent).toBeDefined()

      // Navigate back to property using parent link
      const parentPropertyUrl = parentBuilding._links.parent.href
      const parentPropertyResponse = await request(app.callback()).get(
        parentPropertyUrl
      )
      expect(parentPropertyResponse.status).toBe(200)
    }
  })
})
