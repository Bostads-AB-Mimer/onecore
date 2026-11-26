import nock from 'nock'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'

const path = '/leases/export'

describe(leasingAdapter.getLeasesForExport, () => {
  it('returns the leases and passes array filters as repeated params', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .query({ status: ['current', 'ended'], createdDateFrom: '2026-11-19' })
      .reply(200, { content: [] })

    const result = await leasingAdapter.getLeasesForExport({
      status: ['current', 'ended'],
      createdDateFrom: '2026-11-19',
    })

    expect(result).toEqual({ ok: true, data: [] })
  })

  it('returns invalid-request on 400 instead of reading it as success', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .query(true)
      .reply(400, { error: 'Invalid query parameters' })

    const result = await leasingAdapter.getLeasesForExport({
      createdDateFrom: '2026-02-31',
    })

    expect(result).toEqual({
      ok: false,
      err: 'invalid-request',
      statusCode: 400,
    })
  })

  it('rethrows 503 so the route can answer that the cache is warming up', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .reply(503, { error: 'Lease cache is warming up — retry shortly' })

    await expect(leasingAdapter.getLeasesForExport({})).rejects.toMatchObject({
      response: { status: 503 },
    })
  })

  it('returns unknown on 500', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .reply(500, { error: 'Internal server error' })

    const result = await leasingAdapter.getLeasesForExport({})

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown on network error', async () => {
    nock(config.tenantsLeasesService.url)
      .get(path)
      .replyWithError('Connection refused')

    const result = await leasingAdapter.getLeasesForExport({})

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
