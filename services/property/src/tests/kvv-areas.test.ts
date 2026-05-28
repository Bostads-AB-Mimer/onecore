import request from 'supertest'
import app from '../app'
import * as adapter from '../adapters/kvv-area-adapter'

describe('GET /kvv-areas', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns codes for matching responsible user ids', async () => {
    const spy = jest
      .spyOn(adapter, 'findKvvAreaCodesByResponsibles')
      .mockResolvedValue(['A1', 'A2'])

    const res = await request(app.callback()).get(
      '/kvv-areas?responsibleUserId=u1&responsibleUserId=u2'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([{ code: 'A1' }, { code: 'A2' }])
    expect(spy).toHaveBeenCalledWith(['u1', 'u2'])
  })

  it('returns 200 with empty content when no responsibleUserId param', async () => {
    jest.spyOn(adapter, 'findKvvAreaCodesByResponsibles').mockResolvedValue([])

    const res = await request(app.callback()).get('/kvv-areas')
    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(adapter, 'findKvvAreaCodesByResponsibles')
      .mockRejectedValue(new Error('boom'))

    const res = await request(app.callback()).get(
      '/kvv-areas?responsibleUserId=u1'
    )

    expect(res.status).toBe(500)
    expect(res.body.reason).toBe('boom')
  })
})
