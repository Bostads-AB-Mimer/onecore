import request from 'supertest'
import app from '../app' // Ensure the correct Koa app instance is imported

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const response = await request(app.callback()).get('/health')
    if (response.status !== 200) {
      console.error('Error:', response.body.error)
    }
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('healthy')
  })
})
