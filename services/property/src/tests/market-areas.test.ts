import request from 'supertest'

import app from '../app'
import * as marketAreaAdapter from '../adapters/market-area-adapter'

afterEach(() => {
  jest.restoreAllMocks()
})

const marketAreaListItem = (code: string, name: string | null) => ({
  id: '11111111111111',
  code,
  name,
})

describe('GET /market-areas', () => {
  it('returns every market area', async () => {
    const spy = jest
      .spyOn(marketAreaAdapter, 'listMarketAreas')
      .mockResolvedValue([
        marketAreaListItem('61140', 'Distrikt Väst'),
        marketAreaListItem('61150', null),
      ])

    const res = await request(app.callback()).get('/market-areas')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      marketAreaListItem('61140', 'Distrikt Väst'),
      marketAreaListItem('61150', null),
    ])
    expect(spy).toHaveBeenCalledWith()
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(marketAreaAdapter, 'listMarketAreas')
      .mockRejectedValue(new Error('boom'))

    const res = await request(app.callback()).get('/market-areas')

    expect(res.status).toBe(500)
    expect(res.body.reason).toBe('boom')
  })
})
