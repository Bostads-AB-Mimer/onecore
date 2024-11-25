import axios from 'axios'
import app from '../app'
import port from '../config/port'

const API_BASE = `http://localhost:${port}`
let server: any

describe('API Navigation Tests', () => {
  beforeAll(async () => {
    server = app.listen(port)
  })

  afterAll(async () => {
    server.close()
  })

  it('should get properties in BÄVERN tract and their details', async () => {
    try {
      // Get properties for a specific tract
      const testTract = "TEST_TRACT"
      const propertiesResponse = await axios.get(`${API_BASE}/properties/?tract=${testTract}`)
      expect(propertiesResponse.status).toBe(200)
      expect(propertiesResponse.data.content).toBeDefined()
      expect(Array.isArray(propertiesResponse.data.content)).toBe(true)
      expect(propertiesResponse.data.content.length).toBeGreaterThan(0)
      
      // For each property, get its details
      for (const property of propertiesResponse.data.content) {
        expect(property.propertyId).toBeDefined()
        expect(property.propertyCode).toBeDefined()
        expect(property.tract).toBe(testTract)
        
        // Get detailed property information
        const propertyDetailsResponse = await axios.get(`${API_BASE}/properties/${property.propertyId}/`)
        expect(propertyDetailsResponse.status).toBe(200)
        expect(propertyDetailsResponse.data.content).toBeDefined()
        
        // Verify property details structure
        const propertyDetails = propertyDetailsResponse.data.content
        expect(propertyDetails.propertyId).toBe(property.propertyId)
        expect(propertyDetails.propertyCode).toBe(property.propertyCode)
        expect(propertyDetails.tract).toBe(testTract)
      }
    } catch (error: any) {
      console.error('Test failed:', error.message)
      throw error
    }
  })
})
