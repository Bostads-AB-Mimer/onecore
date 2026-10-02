import request from 'supertest'
import { makeTestApp } from './app-fixture'

describe('GET /leasing-portal/health', () => {
  it('reports core as a subsystem without requiring a token', async () => {
    const { app } = makeTestApp()

    const res = await request(app.callback()).get('/leasing-portal/health')

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('leasing-portal-backend')
    expect(res.body.status).toBe('active')
    expect(res.body.subsystems).toEqual([
      expect.objectContaining({ name: 'core', status: 'active' }),
    ])
  })
})
