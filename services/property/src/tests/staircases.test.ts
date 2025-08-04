import request from 'supertest'
import app from '../app'

describe('Staircases API', () => {
  let buildingCode: string

  beforeAll(async () => {
    // Get a building code to use in tests
    const buildingsResponse = await request(app.callback())
      .get('/buildings')
      .query({ propertyCode: '07901' })
    buildingCode = buildingsResponse.body.content[0].code
  })

  it('should return staircases for a building', async () => {
    const response = await request(app.callback())
      .get('/staircases')
      .query({ buildingCode })

    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()
    expect(Array.isArray(response.body.content)).toBe(true)
    expect(response.body.content.length).toBeGreaterThan(0)

    const staircase = response.body.content[0]
    expect(staircase.id).toBeDefined()
    expect(staircase.code).toBeDefined()
    expect(staircase.name).toBeDefined()
    expect(staircase._links).toBeDefined()
    expect(staircase._links.self).toBeDefined()
    expect(staircase._links.building).toBeDefined()
    expect(staircase._links.residences).toBeDefined()
  })

  it('should validate buildingCode parameter', async () => {
    const response = await request(app.callback())
      .get('/staircases')
      .query({ buildingCode: 'short' }) // Too short building code

    expect(response.status).toBe(400)
    expect(response.body.errors).toBeDefined()
  })
})
