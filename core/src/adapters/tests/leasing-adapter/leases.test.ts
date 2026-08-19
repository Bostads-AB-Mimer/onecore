import nock from 'nock'
import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'
import * as factory from '../../../../test/factories'

const serviceUrl = config.tenantsLeasesService.url

describe(leasingAdapter.getHomeInsuranceExport, () => {
  it('returns ok with parsed rows on 200', async () => {
    const rows = factory.homeInsuranceExportRow.buildList(2)
    nock(serviceUrl).get('/leases/lf-export').reply(200, { content: rows })

    const result = await leasingAdapter.getHomeInsuranceExport()

    expect(result.ok).toBe(true)
    expect(result.ok && result.data).toHaveLength(2)
  })

  it('returns unknown error on non-200 response', async () => {
    nock(serviceUrl)
      .get('/leases/lf-export')
      .reply(500, { error: 'Internal server error' })

    const result = await leasingAdapter.getHomeInsuranceExport()

    expect(result.ok).toBe(false)
    expect(!result.ok && result.err).toBe('unknown')
  })

  it('returns schema-error when response does not match schema', async () => {
    nock(serviceUrl)
      .get('/leases/lf-export')
      .reply(200, { content: [{ invalid: 'data' }] })

    const result = await leasingAdapter.getHomeInsuranceExport()

    expect(result.ok).toBe(false)
    expect(!result.ok && result.err).toBe('schema-error')
  })

  it('returns unknown error on network failure', async () => {
    nock(serviceUrl).get('/leases/lf-export').replyWithError('Network error')

    const result = await leasingAdapter.getHomeInsuranceExport()

    expect(result.ok).toBe(false)
    expect(!result.ok && result.err).toBe('unknown')
  })
})

describe(leasingAdapter.getLeasesByRentalObjectCode, () => {
  it('returns the leases on 200', async () => {
    nock(serviceUrl)
      .get('/leases/by-rental-object-code/705-011-03-0102')
      .query(true)
      .reply(200, { content: [factory.lease.build()] })

    const result =
      await leasingAdapter.getLeasesByRentalObjectCode('705-011-03-0102')

    expect(result).toHaveLength(1)
  })

  // validateStatus keeps axios from throwing on 4xx, so an unguarded 404 body
  // would hand `undefined` to callers that iterate the result.
  it('returns an empty list when the rental object is not found', async () => {
    nock(serviceUrl)
      .get('/leases/by-rental-object-code/does-not-exist')
      .query(true)
      .reply(404, { error: 'Not found' })

    const result =
      await leasingAdapter.getLeasesByRentalObjectCode('does-not-exist')

    expect(result).toEqual([])
  })
})
