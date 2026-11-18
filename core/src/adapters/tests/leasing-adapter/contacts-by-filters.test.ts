import nock from 'nock'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'

const path = '/contacts/from-lease-search'

describe(leasingAdapter.getContactsByFilters, () => {
  it('returns the contacts and passes array filters as repeated params', async () => {
    const content = [
      {
        name: 'Anna Andersson',
        contactCode: 'P000001',
        email: null,
        phone: null,
        contactType: 'tenant',
      },
    ]
    nock(config.tenantsLeasesService.url)
      .get(path)
      .query({ status: ['pendingsignature', 'notsent'], name: 'Anna' })
      .reply(200, { content })

    const result = await leasingAdapter.getContactsByFilters({
      status: ['pendingsignature', 'notsent'],
      name: 'Anna',
    })

    expect(result).toEqual({ ok: true, data: content })
  })

  it('returns schema-error when a 200 response is not a list of contacts', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .reply(200, { message: 'not the leasing service' })

    const result = await leasingAdapter.getContactsByFilters({})

    expect(result).toEqual({ ok: false, err: 'schema-error' })
  })

  it('returns invalid-request on 400 instead of the error body as contacts', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .query(true)
      .reply(400, { error: 'Invalid query parameters' })

    const result = await leasingAdapter.getContactsByFilters({ page: 'abc' })

    expect(result).toEqual({
      ok: false,
      err: 'invalid-request',
      statusCode: 400,
    })
  })

  it('returns service-unavailable on 503', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .reply(503, { error: 'Lease cache is warming up — retry shortly' })

    const result = await leasingAdapter.getContactsByFilters({})

    expect(result).toEqual({
      ok: false,
      err: 'service-unavailable',
      statusCode: 503,
    })
  })

  it('returns unknown on 500', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .reply(500, { error: 'Internal server error' })

    const result = await leasingAdapter.getContactsByFilters({})

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown on network error', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .replyWithError('Connection refused')

    const result = await leasingAdapter.getContactsByFilters({})

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
