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

  it('should navigate from properties to buildings to residences', async () => {
    try {
      // Start by getting properties
      const propertiesResponse = await axios.get(`${API_BASE}/properties/`)
      expect(propertiesResponse.status).toBe(200)
      expect(propertiesResponse.data.content).toBeDefined()
      expect(propertiesResponse.data._links).toBeDefined()
      
      // Get the first property
      const property = propertiesResponse.data.content[0]
      expect(property.propertyCode).toBeDefined()
      
      // Follow link to buildings
      const buildingsResponse = await axios.get(`${API_BASE}/buildings/${property.propertyCode}/`)
      expect(buildingsResponse.status).toBe(200)
      expect(buildingsResponse.data.content).toBeDefined()
      
      // Get the first building
      const building = buildingsResponse.data.content[0]
      expect(building.buildingCode).toBeDefined()
      
      // Follow link to building details
      const buildingDetailsResponse = await axios.get(`${API_BASE}/buildings/byCode/${building.buildingCode}/`)
      expect(buildingDetailsResponse.status).toBe(200)
      expect(buildingDetailsResponse.data.content).toBeDefined()
      
      // Follow link to residences (if building has any)
      if (buildingDetailsResponse.data._links?.residences) {
        const residencesResponse = await axios.get(`${API_BASE}${buildingDetailsResponse.data._links.residences.href}`)
        expect(residencesResponse.status).toBe(200)
        expect(residencesResponse.data.content).toBeDefined()
      }
    } catch (error: any) {
      console.error('Test failed:', error.message)
      throw error
    }
  })
})
