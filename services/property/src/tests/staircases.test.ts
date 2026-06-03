import request from 'supertest'
import app from '../app'
import { Staircase } from '../types/staircase'

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

  describe('GET /staircases/search', () => {
    it('should reject queries shorter than 3 characters', async () => {
      const response = await request(app.callback())
        .get('/staircases/search')
        .query({ q: 'ab' })

      expect(response.status).toBe(400)
      expect(response.body.errors).toBeDefined()
    })

    it('should return an empty array for a query with no matches', async () => {
      const response = await request(app.callback())
        .get('/staircases/search')
        .query({ q: 'no-staircase-should-ever-match-this-query-zzz' })

      expect(response.status).toBe(200)
      expect(response.body.content).toEqual([])
    })

    it('should return matching staircases without placeholder codes (00, 99) and with a building', async () => {
      const staircasesResponse = await request(app.callback())
        .get('/staircases')
        .query({ buildingCode })

      const namedStaircase = staircasesResponse.body.content.find(
        (s: Staircase) => s.name && !['00', '99'].includes(s.code)
      )

      // The shared test fixture is expected to include a real staircase.
      expect(namedStaircase).toBeDefined()
      expect(namedStaircase.name).toBeTruthy()

      const response = await request(app.callback())
        .get('/staircases/search')
        .query({ q: namedStaircase.name.substring(0, 3) })

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body.content)).toBe(true)

      response.body.content.forEach((s: Staircase) => {
        expect(['00', '99']).not.toContain(s.code)
        expect(s.building.buildingCode).toBeTruthy()
      })
    })
  })
})
