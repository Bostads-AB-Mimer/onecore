import request from 'supertest'

import app from '../app'
import * as residenceAdapter from '../adapters/residence-adapter'

afterEach(() => {
  jest.restoreAllMocks()
})

describe('GET /residences/rental-blocks/rental-ids', () => {
  it('returns the rental ids the adapter resolves', async () => {
    const spy = jest
      .spyOn(residenceAdapter, 'getRentalIdsWithBlock')
      .mockResolvedValue(['705-022-04-0201', '705-022-04-0202'])

    const res = await request(app.callback()).get(
      '/residences/rental-blocks/rental-ids?blockReason=SKADEDJUR&active=true'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(['705-022-04-0201', '705-022-04-0202'])
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ blockReason: ['SKADEDJUR'], active: true })
    )
  })

  it('returns an empty list when nothing is blocked', async () => {
    jest.spyOn(residenceAdapter, 'getRentalIdsWithBlock').mockResolvedValue([])

    const res = await request(app.callback()).get(
      '/residences/rental-blocks/rental-ids?blockReason=SKADEDJUR&active=true'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
  })

  it('works with no filters at all', async () => {
    const spy = jest
      .spyOn(residenceAdapter, 'getRentalIdsWithBlock')
      .mockResolvedValue(['705-022-04-0201'])

    const res = await request(app.callback()).get(
      '/residences/rental-blocks/rental-ids'
    )

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ blockReason: undefined, active: undefined })
    )
  })

  it('returns 500 when the adapter throws', async () => {
    jest
      .spyOn(residenceAdapter, 'getRentalIdsWithBlock')
      .mockRejectedValue(new Error('boom'))

    const res = await request(app.callback()).get(
      '/residences/rental-blocks/rental-ids?blockReason=SKADEDJUR'
    )

    expect(res.status).toBe(500)
    expect(res.body.reason).toBe('boom')
  })
})
