import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../common/config'
import * as propertyBaseAdapter from '../property-base-adapter'

const mockServer = setupServer()
const url = `${config.propertyBaseService.url}/rental-objects/residences/leasing-details`

beforeAll(() => mockServer.listen())
afterEach(() => mockServer.resetHandlers())
afterAll(() => mockServer.close())

describe(propertyBaseAdapter.getResidenceLeasingDetails, () => {
  it('posts the ids and parses dates in the blocks', async () => {
    let body: unknown
    mockServer.use(
      http.post(url, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          content: [
            {
              rentalId: 'apt-1',
              address: 'Gatan 1',
              apartmentNumber: '1101',
              propertyCode: '1',
              propertyName: 'P',
              buildingCode: '1-1',
              marketAreaCode: 'VAS',
              marketAreaName: 'Vasastan',
              residenceTypeCode: '2RK',
              residenceTypeName: '2 rum och kök',
              roomCount: 2,
              floor: '2',
              elevator: false,
              area: 55.5,
              rentalBlocks: [
                {
                  fromDate: '2026-10-01T00:00:00.000Z',
                  toDate: null,
                  reason: 'Renovering',
                },
              ],
            },
          ],
        })
      })
    )

    const result = await propertyBaseAdapter.getResidenceLeasingDetails([
      'apt-1',
    ])

    expect(body).toEqual({ rentalIds: ['apt-1'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0].rentalBlocks[0].fromDate).toEqual(
        new Date('2026-10-01T00:00:00.000Z')
      )
    }
  })

  it('skips the request for an empty id list', async () => {
    const result = await propertyBaseAdapter.getResidenceLeasingDetails([])
    expect(result).toEqual({ ok: true, data: [] })
  })

  it('returns err when the service fails', async () => {
    mockServer.use(
      http.post(url, () => new HttpResponse(null, { status: 500 }))
    )

    const result = await propertyBaseAdapter.getResidenceLeasingDetails([
      'apt-1',
    ])

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
