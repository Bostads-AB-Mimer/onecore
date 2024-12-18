import request from 'supertest'
import app from '../app'

describe('Components API', () => {
  it('should return components', async () => {
    const queryParams = {
      buildingCode: '508-005',
      floorCode: '01',
      residenceCode: '0101',
      roomCode: '03',
    }

    const response = await request(app.callback())
      .get('/components')
      .query(queryParams)

    expect(response.status).toBe(200)
    expect(response.body.content).toBeDefined()
    expect(Array.isArray(response.body.content)).toBe(true)

    const component = response.body.content[0]
    expect(component.id).toBeDefined()
    expect(component.code).toBeDefined()
    expect(component.name).toBeDefined()

    expect(component._links.residence).toBeDefined()
    expect(component._links.residence.href).toBe(
      `/residences/${queryParams.residenceCode}`
    )
  })

  it('should validate query parameters', async () => {
    const response = await request(app.callback()).get('/components').query({
      buildingCode: '',
      floorCode: '',
      residenceCode: '',
      roomCode: '',
    })

    expect(response.status).toBe(400)
    expect(response.body.errors).toBeDefined()
    if (response.status === 500) {
      console.error('Test failed with reason:', response.body.reason)
    }
  })
})
