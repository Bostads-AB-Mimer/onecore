import nock from 'nock'
import { ListingStatus, UpdateListingStatusErrorCodes } from '@onecore/types'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'
import * as factory from '../../../../test/factories'

beforeEach(() => {
  nock.cleanAll() // Rensar alla tidigare mockade HTTP-förfrågningar
})

afterAll(() => {
  nock.restore() // Återställer nock till sitt ursprungliga tillstånd
})

describe(leasingAdapter.getListingsWithApplicants, () => {
  it('returns err if request fails', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings-with-applicants')
      .reply(500)

    const result = await leasingAdapter.getListingsWithApplicants('')

    expect(result.ok).toBe(false)
  })

  it('returns listings', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings-with-applicants')
      .query({ type: 'published' })
      .reply(200, { content: factory.listing.buildList(1) })

    const result =
      await leasingAdapter.getListingsWithApplicants('type=published')

    expect(result).toMatchObject({
      ok: true,
      data: [expect.objectContaining({ id: expect.any(Number) })],
    })
  })
})

describe(leasingAdapter.updateListingStatus, () => {
  it('returns err if leasing responds with 404', async () => {
    nock(config.tenantsLeasesService.url).put('/listings/123/status').reply(404)

    const result = await leasingAdapter.updateListingStatus(
      123,
      ListingStatus.Expired
    )

    expect(result).toEqual({
      ok: false,
      err: UpdateListingStatusErrorCodes.NotFound,
      statusCode: 404,
    })
  })

  it('returns err if leasing responds with 400', async () => {
    nock(config.tenantsLeasesService.url).put('/listings/123/status').reply(400)

    const result = await leasingAdapter.updateListingStatus(
      123,
      ListingStatus.Expired
    )

    expect(result).toEqual({
      ok: false,
      err: UpdateListingStatusErrorCodes.BadRequest,
      statusCode: 400,
    })
  })

  it('returns err if leasing responds with 500', async () => {
    nock(config.tenantsLeasesService.url).put('/listings/123/status').reply(500)

    const result = await leasingAdapter.updateListingStatus(
      123,
      ListingStatus.Expired
    )

    expect(result).toEqual({
      ok: false,
      err: UpdateListingStatusErrorCodes.Unknown,
      statusCode: 500,
    })
  })

  it('returns ok if leasing responds with 200', async () => {
    nock(config.tenantsLeasesService.url).put('/listings/123/status').reply(200)

    const result = await leasingAdapter.updateListingStatus(
      123,
      ListingStatus.Expired
    )

    expect(result).toEqual({ ok: true, data: null })
  })
})

describe(leasingAdapter.getActiveListingByRentalObjectCode, () => {
  it('returns err if leasing responds with 404', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings/active/by-code/123')
      .reply(404)

    const result =
      await leasingAdapter.getActiveListingByRentalObjectCode('123')

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns err if leasing responds with 500', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings/active/by-code/123')
      .reply(500)

    const result =
      await leasingAdapter.getActiveListingByRentalObjectCode('123')

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns an active listing', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings/active/by-code/123')
      .reply(200, {
        content: factory.listing.build({
          rentalObjectCode: '123',
          status: ListingStatus.Active,
        }),
      })

    const result =
      await leasingAdapter.getActiveListingByRentalObjectCode('123')

    expect(result).toMatchObject({
      ok: true,
      data: expect.objectContaining({
        rentalObjectCode: '123',
        status: ListingStatus.Active,
      }),
    })
  })
})

describe(leasingAdapter.getListings, () => {
  it('returns err if leasing responds with 500', async () => {
    nock(config.tenantsLeasesService.url).get('/listings').reply(500)

    const result = await leasingAdapter.getListings({ published: true })

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns a list of listings without filters', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings')
      .reply(200, { content: factory.listing.buildList(5) })

    const result = await leasingAdapter.getListings()

    expect(result).toMatchObject({
      ok: true,
      data: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
  })

  it('returns a list of listings with rentalRule filter', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings')
      .query({ rentalRule: 'SCORED' })
      .reply(200, { content: factory.listing.buildList(2) })

    const result = await leasingAdapter.getListings({ rentalRule: 'SCORED' })

    expect(result).toMatchObject({
      ok: true,
      data: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
  })

  it('returns a list of listings with published filter', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings')
      .query({ published: 'true' })
      .reply(200, { content: factory.listing.buildList(3) })

    const result = await leasingAdapter.getListings({ published: true })

    expect(result).toMatchObject({
      ok: true,
      data: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
  })

  it('returns a list of listings with listingCategory filter', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings')
      .query({ listingCategory: 'PARKING_SPACE' })
      .reply(200, { content: factory.listing.buildList(4) })

    const result = await leasingAdapter.getListings({
      listingCategory: 'PARKING_SPACE',
    })

    expect(result).toMatchObject({
      ok: true,
      data: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
  })

  it('returns a list listings filtered on published and rentalObjectCode', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/listings')
      .query({ rentalObjectCode: 'ABC1234', published: true })
      .reply(200, { content: factory.listing.buildList(4) })

    const result = await leasingAdapter.getListings({
      rentalObjectCode: 'ABC1234',
      published: true,
    })

    expect(result).toMatchObject({
      ok: true,
      data: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(Number) }),
      ]),
    })
  })
})
