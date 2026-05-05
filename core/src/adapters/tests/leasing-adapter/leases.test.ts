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
