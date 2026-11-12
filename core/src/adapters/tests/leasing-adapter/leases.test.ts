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

describe(leasingAdapter.createLease, () => {
  const params = {
    objectId: '705-022-99-0010',
    contactId: 'P123456',
    fromDate: '2026-08-31T00:00:00.000Z',
    companyCode: '001',
    includeVAT: true,
  }

  it('returns ok with the created lease id on 200', async () => {
    nock(serviceUrl).post('/leases').reply(200, { content: 'lease-123' })

    const result = await leasingAdapter.createLease(
      params.objectId,
      params.contactId,
      params.fromDate,
      params.companyCode,
      params.includeVAT
    )

    expect(result).toEqual({ ok: true, data: 'lease-123' })
  })

  it('returns rental-object-not-available on a 409 with that error code', async () => {
    nock(serviceUrl)
      .post('/leases')
      .reply(409, { error: 'rental-object-not-available' })

    const result = await leasingAdapter.createLease(
      params.objectId,
      params.contactId,
      params.fromDate,
      params.companyCode,
      params.includeVAT
    )

    expect(result).toEqual({ ok: false, err: 'rental-object-not-available' })
  })

  it('returns ok:false instead of throwing on a 500', async () => {
    nock(serviceUrl)
      .post('/leases')
      .reply(500, { error: 'Internal server error' })

    const result = await leasingAdapter.createLease(
      params.objectId,
      params.contactId,
      params.fromDate,
      params.companyCode,
      params.includeVAT
    )

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown error on network failure', async () => {
    nock(serviceUrl).post('/leases').replyWithError('Network error')

    const result = await leasingAdapter.createLease(
      params.objectId,
      params.contactId,
      params.fromDate,
      params.companyCode,
      params.includeVAT
    )

    expect(result).toEqual({ ok: false, err: 'unknown' })
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

describe(leasingAdapter.getLeasesForPropertyId, () => {
  const options = {
    includeUpcomingLeases: true,
    includeTerminatedLeases: false,
    includeContacts: false,
  }

  it('returns the leases on 200', async () => {
    nock(serviceUrl)
      .get('/leases/by-rental-object-code/705-011-03-0102')
      .query(true)
      .reply(200, { content: [factory.lease.build()] })

    const result = await leasingAdapter.getLeasesForPropertyId(
      '705-011-03-0102',
      options
    )

    expect(result).toHaveLength(1)
  })

  it('returns an empty list when leasing has no leases for the rental object', async () => {
    nock(serviceUrl)
      .get('/leases/by-rental-object-code/no-leases')
      .query(true)
      .reply(404, { error: 'rental-object-not-found' })

    const result = await leasingAdapter.getLeasesForPropertyId(
      'no-leases',
      options
    )

    expect(result).toEqual([])
  })

  // A failed lookup must not be read as "no leases": the object may be rented.
  it.each([400, 500, 503])('throws when leasing answers %i', async (status) => {
    nock(serviceUrl)
      .get('/leases/by-rental-object-code/705-011-03-0102')
      .query(true)
      .reply(status, { error: 'could-not-fetch-rental-object' })

    await expect(
      leasingAdapter.getLeasesForPropertyId('705-011-03-0102', options)
    ).rejects.toThrow()
  })
})

describe(leasingAdapter.getLeasesByContactCode, () => {
  const { contactCode } = factory.contact.build()

  it('asks leasing for sublet leases when includeSubletLeases is true', async () => {
    const scope = nock(serviceUrl)
      .get(`/leases/by-contact-code/${contactCode}`)
      .query({ includeSubletLeases: 'true' })
      .reply(200, { content: [] })

    await leasingAdapter.getLeasesByContactCode(contactCode, {
      includeSubletLeases: true,
    })

    expect(scope.isDone()).toBe(true)
  })

  it('leaves the parameter out otherwise', async () => {
    const scope = nock(serviceUrl)
      .get(`/leases/by-contact-code/${contactCode}`)
      .query({ status: 'current' })
      .reply(200, { content: [] })

    await leasingAdapter.getLeasesByContactCode(contactCode, {
      status: ['current'],
    })

    expect(scope.isDone()).toBe(true)
  })
})

describe(leasingAdapter.getLease, () => {
  const leaseId = '307-002-11-0201/11'
  const leasePath = `/leases/${encodeURIComponent(leaseId)}`

  it('returns the lease on 200', async () => {
    nock(serviceUrl).get(leasePath).reply(200, { content: { leaseId } })

    expect(await leasingAdapter.getLease(leaseId)).toEqual({ leaseId })
  })

  it('returns null on 404', async () => {
    nock(serviceUrl).get(leasePath).reply(404, { error: 'not-found' })

    expect(await leasingAdapter.getLease(leaseId)).toBeNull()
  })

  it('throws on any other 4xx instead of reporting not found', async () => {
    nock(serviceUrl).get(leasePath).reply(400, { error: 'bad-request' })

    await expect(leasingAdapter.getLease(leaseId)).rejects.toThrow()
  })
})
