import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../common/config'
import * as propertyBaseAdapter from '../property-base-adapter'

const mockServer = setupServer()
const residencesUrl = `${config.propertyBaseService.url}/residences/batch`
const blocksUrl = `${config.propertyBaseService.url}/rental-blocks/batch`

beforeAll(() => mockServer.listen())
afterEach(() => mockServer.resetHandlers())
afterAll(() => mockServer.close())

describe(propertyBaseAdapter.getResidencesBatch, () => {
  it('posts the ids and returns the parsed residences', async () => {
    let body: unknown
    mockServer.use(
      http.post(residencesUrl, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          content: [
            {
              rentalId: 'apt-1',
              code: '1101',
              name: 'Lägenhet 1101',
              apartmentNumber: '1101',
              address: {
                street: 'Gatan 1',
                street2: null,
                postalCode: '722 12',
                city: 'Västerås',
              },
              property: { code: '1', name: 'P' },
              building: { code: '1-1', name: null },
              marketArea: { code: 'VAS', name: 'Vasastan' },
              residenceType: {
                code: '2RK',
                name: '2 rum och kök',
                roomCount: 2,
              },
              floor: '2',
              elevator: false,
              area: 55.5,
            },
          ],
        })
      })
    )

    const result = await propertyBaseAdapter.getResidencesBatch(['apt-1'])

    expect(body).toEqual({ rentalIds: ['apt-1'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        rentalId: 'apt-1',
        address: { street: 'Gatan 1', city: 'Västerås' },
        residenceType: { roomCount: 2 },
        area: 55.5,
      })
    }
  })

  it('skips the request for an empty id list', async () => {
    const result = await propertyBaseAdapter.getResidencesBatch([])
    expect(result).toEqual({ ok: true, data: [] })
  })

  it('returns err when the service fails', async () => {
    mockServer.use(
      http.post(residencesUrl, () => new HttpResponse(null, { status: 500 }))
    )

    const result = await propertyBaseAdapter.getResidencesBatch(['apt-1'])

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(propertyBaseAdapter.getRentalBlocksBatch, () => {
  it('posts the ids and parses the block dates', async () => {
    let body: unknown
    mockServer.use(
      http.post(blocksUrl, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          content: [
            {
              id: 'block-1',
              rentalId: 'apt-1',
              blockReasonId: 'reason-1',
              blockReason: 'Renovering',
              fromDate: '2026-10-01T00:00:00.000Z',
              toDate: null,
              amount: null,
            },
          ],
        })
      })
    )

    const result = await propertyBaseAdapter.getRentalBlocksBatch(['apt-1'])

    expect(body).toEqual({ rentalIds: ['apt-1'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0].fromDate).toEqual(
        new Date('2026-10-01T00:00:00.000Z')
      )
      expect(result.data[0].toDate).toBeNull()
    }
  })

  it('returns err when the service fails', async () => {
    mockServer.use(
      http.post(blocksUrl, () => new HttpResponse(null, { status: 500 }))
    )

    const result = await propertyBaseAdapter.getRentalBlocksBatch(['apt-1'])

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
