import request from 'supertest'
import app from '../../app'

describe('HATEOAS Components Navigation', () => {
  it('should navigate from residence to its components', async () => {
    // Get a residence first
    const companiesResponse = await request(app.callback()).get('/companies')
    const company = companiesResponse.body.content[0]
    const propertiesUrl = company._links.properties.href
    const propertiesResponse = await request(app.callback()).get(propertiesUrl)
    const property = propertiesResponse.body.content[0]
    const buildingsUrl = property._links.buildings.href
    const buildingsResponse = await request(app.callback()).get(buildingsUrl)
    const building = buildingsResponse.body.content[0]
    const residencesUrl = building._links.residences.href
    const residencesResponse = await request(app.callback()).get(residencesUrl)

    if (residencesResponse.body.content?.length > 0) {
      const residence = residencesResponse.body.content[0]
      expect(residence._links.components).toBeDefined()

      const componentsUrl = residence._links.components.href
      const componentsResponse = await request(app.callback()).get(
        componentsUrl
      )
      expect(componentsResponse.status).toBe(200)
    }
  })

  it('should navigate from residence to its rooms', async () => {
    const residencesResponse = await request(app.callback())
      .get('/residences')
      .query({ buildingCode: '0790101' })

    if (residencesResponse.body.content?.length > 0) {
      const residenceLink = residencesResponse.body.content[0]._links.self
      const residence = await request(app.callback()).get(residenceLink.href)
      expect(residence.body.content._links.rooms).toBeDefined()

      const roomsUrl = residence.body.content._links.rooms.href
      const roomsResponse = await request(app.callback()).get(roomsUrl)
      expect(roomsResponse.status).toBe(200)

      if (roomsResponse.body.content.length > 0) {
        const room = roomsResponse.body.content[0]
        expect(room._links.self).toBeDefined()
        expect(room._links.residence).toBeDefined()
        expect(room._links.parent).toBeDefined()
      }
    }
  })
})
