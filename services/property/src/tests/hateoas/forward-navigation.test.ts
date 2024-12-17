import request from 'supertest'
import app from '../../app'

describe('HATEOAS Forward Navigation', () => {
  it('should navigate from companies to properties', async () => {
    const companiesResponse = await request(app.callback()).get('/companies')
    expect(companiesResponse.status).toBe(200)
    expect(companiesResponse.body.content.length).toBeGreaterThan(0)

    const company = companiesResponse.body.content[0]
    expect(company._links.properties).toBeDefined()

    const propertiesUrl = company._links.properties.href
    const propertiesResponse = await request(app.callback()).get(propertiesUrl)
    expect(propertiesResponse.status).toBe(200)
    expect(propertiesResponse.body.content.length).toBeGreaterThan(0)
  })

  it('should navigate from properties to buildings', async () => {
    const companiesResponse = await request(app.callback()).get('/companies')
    const company = companiesResponse.body.content[0]
    const propertiesUrl = company._links.properties.href
    const propertiesResponse = await request(app.callback()).get(propertiesUrl)
    
    const property = propertiesResponse.body.content[0]
    expect(property._links.buildings).toBeDefined()

    const buildingsUrl = property._links.buildings.href
    const buildingsResponse = await request(app.callback()).get(buildingsUrl)
    expect(buildingsResponse.status).toBe(200)
    expect(buildingsResponse.body.content.length).toBeGreaterThan(0)
  })

  it('should navigate from buildings to residences and staircases', async () => {
    const companiesResponse = await request(app.callback()).get('/companies')
    const company = companiesResponse.body.content[0]
    const propertiesUrl = company._links.properties.href
    const propertiesResponse = await request(app.callback()).get(propertiesUrl)
    const property = propertiesResponse.body.content[0]
    const buildingsUrl = property._links.buildings.href
    const buildingsResponse = await request(app.callback()).get(buildingsUrl)
    
    const building = buildingsResponse.body.content[0]
    expect(building._links.staircases).toBeDefined()
    expect(building._links.residences).toBeDefined()

    const staircasesUrl = building._links.staircases.href
    const staircasesResponse = await request(app.callback()).get(staircasesUrl)
    expect(staircasesResponse.status).toBe(200)

    const residencesUrl = building._links.residences.href
    const residencesResponse = await request(app.callback()).get(residencesUrl)
    expect(residencesResponse.status).toBe(200)
  })
})
