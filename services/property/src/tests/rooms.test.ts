import request from 'supertest'
import app from '../app'

describe('Rooms API', () => {
  let buildingCode: string
  let floorCode: string
  let residenceCode: string

  beforeAll(async () => {
    // Get codes needed for testing
    const buildingsResponse = await request(app.callback())
      .get('/buildings')
      .query({ propertyCode: '07901' })
    buildingCode = buildingsResponse.body.content[0].code

    const residencesResponse = await request(app.callback())
      .get('/residences')
      .query({ buildingCode })
    const residence = residencesResponse.body.content[0]
    residenceCode = residence.code
    floorCode = '1' // Assuming floor code 1 exists
  })

  it('should return rooms for a residence', async () => {
    const response = await request(app.callback())
      .get('/rooms')
      .query({ buildingCode, floorCode, residenceCode })

    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()
    expect(Array.isArray(response.body.content)).toBe(true)

    if (response.body.content.length > 0) {
      const room = response.body.content[0]
      expect(room.id).toBeDefined()
      expect(room.code).toBeDefined()
      expect(room._links).toBeDefined()
      expect(room._links.self).toBeDefined()
      expect(room._links.residence).toBeDefined()
      expect(room._links.building).toBeDefined()
    }
  })

  it('should validate required query parameters', async () => {
    const response = await request(app.callback())
      .get('/rooms')
      .query({ buildingCode }) // Missing required parameters

    expect(response.status).toBe(400)
    expect(response.body.errors).toBeDefined()
    if (response.status === 500) {
      console.error('Test failed with reason:', response.body.reason)
    }
  })

  it('should return room details by ID', async () => {
    // First get a room ID from the list
    const roomsResponse = await request(app.callback())
      .get('/rooms')
      .query({ buildingCode, floorCode, residenceCode })

    if (roomsResponse.body.content.length > 0) {
      const roomId = roomsResponse.body.content[0].id

      const response = await request(app.callback()).get(`/rooms/${roomId}`)
      expect(response.status).toBe(200)
      expect(response.body.content).toBeDefined()

      const room = response.body.content
      expect(room.id).toBe(roomId)
      expect(room.code).toBeDefined()
      expect(room._links).toBeDefined()
    }
  })
})
