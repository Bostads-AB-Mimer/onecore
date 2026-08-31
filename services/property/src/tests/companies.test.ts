import request from 'supertest'
import app from '../app'

describe('Companies API', () => {
  it('should return a list of companies', async () => {
    const response = await request(app.callback()).get('/companies')
    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()
    expect(Array.isArray(response.body.content)).toBe(true)
    expect(response.body.content.length).toBeGreaterThan(0)

    const company = response.body.content[0]
    expect(company.id).toBeDefined()
    expect(company.code).toBeDefined()
    expect(company.name).toBeDefined()
    expect(company.organizationNumber).toBeDefined()
    expect(company._links).toBeDefined()
    expect(company._links.self).toBeDefined()
    expect(company._links.properties).toBeDefined()
  })

  it('should return company details by organization number', async () => {
    // First get an organization number from the list
    const companiesResponse = await request(app.callback()).get('/companies')
    const organizationNumber =
      companiesResponse.body.content[0].organizationNumber

    const response = await request(app.callback()).get(
      `/companies/${organizationNumber}`
    )
    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()

    const company = response.body.content
    expect(company.organizationNumber).toBe(organizationNumber)
    expect(company.code).toBeDefined()
    expect(company.name).toBeDefined()
    expect(company._links).toBeDefined()
    expect(company._links.self).toBeDefined()
    expect(company._links.properties).toBeDefined()
  })

  it('should return 404 for non-existent organization number', async () => {
    const response = await request(app.callback()).get('/companies/nonexistent')
    expect(response.status).toBe(404)
  })
})
