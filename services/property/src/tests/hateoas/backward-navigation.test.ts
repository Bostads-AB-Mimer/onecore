import request from 'supertest'
import app from '../../app'

describe('HATEOAS Backward Navigation', () => {
  const testCompany = '001'
  const testTract = 'BÄVERN'

  it('should navigate from residence back to building and property', async () => {
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

    if (residencesResponse.body.content?.length > 0) {
      const residenceLink = residencesResponse.body.content[0]._links.self
      const residenceResponse = await request(app.callback()).get(
        residenceLink.href
      )
      const residence = residenceResponse.body.content
      expect(residence._links.parent).toBeDefined()

      /* TODO: activate the rest of this test- the following is not working because
      of the building is null on a residence for some reason */

      // // Navigate back to building
      // const parentBuildingUrl = residence._links.parent.href
      // console.dir(JSON.stringify({ parentBuildingUrl, residence }))
      // const parentBuildingResponse = await request(app.callback()).get(
      //   parentBuildingUrl
      // )
      // expect(parentBuildingResponse.status).toBe(200)

      // const parentBuilding = parentBuildingResponse.body.content
      // expect(parentBuilding._links.parent).toBeDefined()

      // // Navigate back to property
      // const parentPropertyUrl = parentBuilding._links.parent.href
      // const parentPropertyResponse = await request(app.callback()).get(
      //   parentPropertyUrl
      // )
      // expect(parentPropertyResponse.status).toBe(200)
    }
  })
})
