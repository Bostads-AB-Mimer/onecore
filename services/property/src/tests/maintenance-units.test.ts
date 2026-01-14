import request from 'supertest'
import app from '../app'

describe('Maintenance Units API', () => {
  describe('GET /maintenance-units/search', () => {
    it('should return maintenance units matching the search query', async () => {
      const response = await request(app.callback())
        .get('/maintenance-units/search')
        .query({ q: '705' })

      expect(response.status).toBe(200)
      expect(response.body.content).toBeDefined()
      expect(Array.isArray(response.body.content)).toBe(true)

      if (response.body.content.length > 0) {
        const unit = response.body.content[0]
        expect(unit.id).toBeDefined()
        expect(unit.code).toBeDefined()
        expect(unit.caption).toBeDefined()
        expect(unit.type).toBeDefined()
        expect(unit.estateCode).toBeDefined()
        expect(unit.estate).toBeDefined()
      }
    })

    it('should return 400 when query parameter is missing', async () => {
      const response = await request(app.callback()).get(
        '/maintenance-units/search'
      )

      expect(response.status).toBe(400)
      expect(response.body.reason).toBeDefined()
    })

    it('should return empty array when no results match', async () => {
      const response = await request(app.callback())
        .get('/maintenance-units/search')
        .query({ q: 'NONEXISTENT12345' })

      expect(response.status).toBe(200)
      expect(response.body.content).toBeDefined()
      expect(Array.isArray(response.body.content)).toBe(true)
      expect(response.body.content.length).toBe(0)
    })
  })

  describe('GET /maintenance-units/by-code/:code', () => {
    it('should return a maintenance unit by its code', async () => {
      // First search for a valid code
      const searchResponse = await request(app.callback())
        .get('/maintenance-units/search')
        .query({ q: '705' })

      if (searchResponse.body.content.length === 0) {
        console.log('No maintenance units found to test by-code endpoint')
        return
      }

      const testCode = searchResponse.body.content[0].code

      const response = await request(app.callback()).get(
        `/maintenance-units/by-code/${testCode}`
      )

      expect(response.status).toBe(200)
      expect(response.body.content).toBeDefined()
      expect(response.body.content.code).toBe(testCode)
      expect(response.body.content.id).toBeDefined()
      expect(response.body.content.caption).toBeDefined()
      expect(response.body.content.type).toBeDefined()
    })

    it('should return 404 for non-existent maintenance unit code', async () => {
      const response = await request(app.callback()).get(
        '/maintenance-units/by-code/NONEXISTENT12345'
      )

      expect(response.status).toBe(404)
      expect(response.body.reason).toBeDefined()
    })
  })
})
