import request from 'supertest'
import { makeTestApp } from './app-fixture'

describe('OpenAPI', () => {
  it('serves the spec under the route prefix without a token', async () => {
    const { app } = makeTestApp()

    const res = await request(app.callback()).get(
      '/leasing-portal/openapi.json'
    )

    expect(res.status).toBe(200)
    expect(res.body.info.title).toBe('ONECore leasing-portal-backend')
    expect(res.body.servers).toEqual([{ url: '/leasing-portal' }])
    expect(Object.keys(res.body.paths)).toContain('/auth/profile')
  })
})
