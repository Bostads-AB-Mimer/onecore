import nock from 'nock'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'
import * as factory from '../../../../test/factories'

beforeEach(() => nock.cleanAll())
afterAll(() => nock.restore())

describe(leasingAdapter.getVacantRentalObjectAvailabilities, () => {
  it('passes the type as a query parameter and returns the content', async () => {
    const availability = factory.rentalObjectAvailabilityInfo.build()
    nock(config.tenantsLeasesService.url)
      .get('/vacant-rental-objects/availabilities')
      .query({ type: 'apartment' })
      .reply(200, { content: [availability] })

    const result =
      await leasingAdapter.getVacantRentalObjectAvailabilities('apartment')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0].rentalObjectCode).toBe(
        availability.rentalObjectCode
      )
    }
  })

  it('returns err on a non-200', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/vacant-rental-objects/availabilities')
      .query(true)
      .reply(500)

    const result =
      await leasingAdapter.getVacantRentalObjectAvailabilities('apartment')

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(leasingAdapter.getListingSummariesByRentalObjectCodes, () => {
  const params = {
    rentalObjects: [{ rentalObjectCode: 'apt-1', listingHistorySince: null }],
    listingCategory: 'APARTMENT' as const,
  }

  it('posts the codes and parses the summaries', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/listings/summaries', params)
      .reply(200, {
        content: [
          {
            rentalObjectCode: 'apt-1',
            currentListing: null,
            closedListingsSinceLastLease: 1,
          },
        ],
      })

    const result =
      await leasingAdapter.getListingSummariesByRentalObjectCodes(params)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        rentalObjectCode: 'apt-1',
        closedListingsSinceLastLease: 1,
      })
    }
  })

  it('skips the request for an empty code list', async () => {
    const scope = nock(config.tenantsLeasesService.url)
      .post('/listings/summaries')
      .reply(200, { content: [] })

    const result = await leasingAdapter.getListingSummariesByRentalObjectCodes({
      ...params,
      rentalObjects: [],
    })

    expect(result).toEqual({ ok: true, data: [] })
    expect(scope.isDone()).toBe(false)
  })

  it('returns err on a non-200', async () => {
    nock(config.tenantsLeasesService.url).post('/listings/summaries').reply(500)

    const result =
      await leasingAdapter.getListingSummariesByRentalObjectCodes(params)

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
