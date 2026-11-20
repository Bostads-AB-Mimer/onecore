import nock from 'nock'
import { LeaseStatus } from '@onecore/types'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'

const serviceUrl = config.tenantsLeasesService.url

const leaseId = '307-002-11-0201/11'
const basePath = `/leases/${encodeURIComponent(leaseId)}/home-insurance`
const row = {
  rowId: 'row-1',
  monthlyAmount: 80,
  from: '2024-01-01',
  to: '2024-12-31',
}

const item = {
  leaseId,
  leaseStatus: 'G',
  leaseStage: LeaseStatus.Current,
  leaseFromDate: '2024-01-01',
  leaseToDate: null,
  rentalObjectCode: '307-002-11-0201',
  numberOfRooms: 2,
  squareMeters: 55,
  address: 'Testgatan 1',
  postalCode: '72216',
  city: 'Västerås',
  rowId: 'row-1',
  rowFromDate: '2024-01-01',
  rowToDate: null,
  monthlyAmount: 80,
  articleText: 'Hemförsäkring',
  contactCode: 'P158770',
  isCompany: false,
}

afterEach(() => nock.cleanAll())

describe(leasingAdapter.getLeaseHomeInsurance, () => {
  it('returns the row with its rowId on 200', async () => {
    nock(serviceUrl).get(basePath).reply(200, { content: row })

    expect(await leasingAdapter.getLeaseHomeInsurance(leaseId)).toEqual({
      ok: true,
      data: row,
    })
  })

  it("passes leasing's own error code through with its status", async () => {
    nock(serviceUrl)
      .get(basePath)
      .reply(404, { error: 'home-insurance-row-not-found' })

    expect(await leasingAdapter.getLeaseHomeInsurance(leaseId)).toEqual({
      ok: false,
      err: 'home-insurance-row-not-found',
      statusCode: 404,
    })
  })

  it('returns upstream-failed on a 503 without a known code', async () => {
    nock(serviceUrl).get(basePath).reply(503, 'Service Unavailable')

    expect(await leasingAdapter.getLeaseHomeInsurance(leaseId)).toEqual({
      ok: false,
      err: 'upstream-failed',
      statusCode: 503,
    })
  })
})

describe(leasingAdapter.cancelLeaseHomeInsurance, () => {
  const endDate = new Date('2024-12-31T00:00:00.000Z')

  it('returns ok on 200', async () => {
    const scope = nock(serviceUrl)
      .post(`${basePath}/cancel`, { endDate: endDate.toISOString() })
      .reply(200, { content: null })

    expect(
      await leasingAdapter.cancelLeaseHomeInsurance(leaseId, { endDate })
    ).toEqual({ ok: true, data: null })
    expect(scope.isDone()).toBe(true)
  })

  it('returns invalid-request with the reason on a 400', async () => {
    nock(serviceUrl)
      .post(`${basePath}/cancel`)
      .reply(400, {
        status: 'error',
        data: [{ message: 'Invalid date', path: ['endDate'] }],
      })

    expect(
      await leasingAdapter.cancelLeaseHomeInsurance(leaseId, { endDate })
    ).toEqual({
      ok: false,
      err: 'invalid-request',
      statusCode: 400,
      detail: 'Invalid date',
    })
  })

  it('returns unknown, not ok, on a network failure', async () => {
    nock(serviceUrl).post(`${basePath}/cancel`).replyWithError('reset')

    expect(
      await leasingAdapter.cancelLeaseHomeInsurance(leaseId, { endDate })
    ).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(leasingAdapter.updateLeaseHomeInsuranceRow, () => {
  const rowPath = `${basePath}/rows/row-1`
  const body = { endDate: '2024-12-31', action: 'set-end' as const }

  it('sends the body and returns the new row on 200', async () => {
    const scope = nock(serviceUrl)
      .patch(rowPath, body)
      .reply(200, {
        content: { action: 'ended', row: { ...row, rowId: 'row-2' } },
      })

    expect(
      await leasingAdapter.updateLeaseHomeInsuranceRow(leaseId, 'row-1', body)
    ).toEqual({
      ok: true,
      data: { action: 'ended', row: { ...row, rowId: 'row-2' } },
    })
    expect(scope.isDone()).toBe(true)
  })

  it("passes leasing's 409 home-insurance-row-changed through", async () => {
    nock(serviceUrl)
      .patch(rowPath)
      .reply(409, { error: 'home-insurance-row-changed' })

    expect(
      await leasingAdapter.updateLeaseHomeInsuranceRow(leaseId, 'row-1', body)
    ).toEqual({ ok: false, err: 'home-insurance-row-changed', statusCode: 409 })
  })

  it('returns unknown, never ok, when a 200 does not parse', async () => {
    nock(serviceUrl)
      .patch(rowPath)
      .reply(200, { content: { action: 'ended' } })

    expect(
      await leasingAdapter.updateLeaseHomeInsuranceRow(leaseId, 'row-1', body)
    ).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns unknown on any other status', async () => {
    nock(serviceUrl).patch(rowPath).reply(500, { error: 'boom' })

    expect(
      await leasingAdapter.updateLeaseHomeInsuranceRow(leaseId, 'row-1', body)
    ).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
  })
})

describe(leasingAdapter.listHomeInsurances, () => {
  const query = {
    rows: 'lf' as const,
    sortBy: 'leaseId' as const,
    sortOrder: 'asc' as const,
    page: 2,
    limit: 50,
  }
  const page = {
    content: [item],
    _meta: { totalRecords: 51, page: 2, limit: 50, count: 1 },
    _links: [],
  }

  it('sends the query and returns the page on 200', async () => {
    const scope = nock(serviceUrl)
      .get('/leases/home-insurances')
      .query({
        q: 'Testgatan',
        status: 'G,K',
        rows: 'lf',
        sameDate: 'true',
        sortBy: 'leaseId',
        sortOrder: 'asc',
        page: '2',
        limit: '50',
      })
      .reply(200, page)

    const result = await leasingAdapter.listHomeInsurances({
      ...query,
      q: 'Testgatan',
      status: ['G', 'K'],
      sameDate: true,
    })

    expect(result).toEqual({ ok: true, data: page })
    expect(scope.isDone()).toBe(true)
  })

  it('sends an empty contactCodes, which matches nothing rather than everything', async () => {
    const scope = nock(serviceUrl)
      .get('/leases/home-insurances')
      .query((params) => params.contactCodes === '')
      .reply(200, { ...page, content: [] })

    await leasingAdapter.listHomeInsurances({ ...query, contactCodes: [] })

    expect(scope.isDone()).toBe(true)
  })

  it('returns cache-warming with the Retry-After header', async () => {
    nock(serviceUrl)
      .get('/leases/home-insurances')
      .query(true)
      .reply(503, { error: 'cache-warming' }, { 'Retry-After': '30' })

    expect(await leasingAdapter.listHomeInsurances(query)).toEqual({
      ok: false,
      err: 'cache-warming',
      statusCode: 503,
      retryAfter: '30',
    })
  })

  it("passes leasing's 400 invalid-query through", async () => {
    nock(serviceUrl)
      .get('/leases/home-insurances')
      .query(true)
      .reply(400, { error: 'invalid-query' })

    expect(await leasingAdapter.listHomeInsurances(query)).toEqual({
      ok: false,
      err: 'invalid-query',
      statusCode: 400,
      retryAfter: undefined,
    })
  })
})

describe(leasingAdapter.listAllHomeInsurances, () => {
  const query = {
    rows: 'all' as const,
    sortBy: 'leaseId' as const,
    sortOrder: 'desc' as const,
  }

  it('sends the query without paging and returns every item on 200', async () => {
    const scope = nock(serviceUrl)
      .get('/leases/home-insurances/all')
      .query({
        q: 'Testgatan',
        rows: 'all',
        sortBy: 'leaseId',
        sortOrder: 'desc',
      })
      .reply(200, { content: [item] })

    const result = await leasingAdapter.listAllHomeInsurances({
      ...query,
      q: 'Testgatan',
    })

    expect(result).toEqual({ ok: true, data: [item] })
    expect(scope.isDone()).toBe(true)
  })
})

describe(leasingAdapter.getLeaseStatuses, () => {
  it('sends the lease IDs and returns the statuses on 200', async () => {
    const content = {
      statuses: [{ leaseId, status: LeaseStatus.Ended }],
      notFoundLeaseIds: ['MISSING/01'],
    }
    const scope = nock(serviceUrl)
      .post('/leases/statuses', { leaseIds: [leaseId, 'MISSING/01'] })
      .reply(200, { content })

    const result = await leasingAdapter.getLeaseStatuses([
      leaseId,
      'MISSING/01',
    ])

    expect(result).toEqual({ ok: true, data: content })
    expect(scope.isDone()).toBe(true)
  })

  it("passes leasing's 503 cache-warming through", async () => {
    nock(serviceUrl)
      .post('/leases/statuses')
      .reply(503, { error: 'cache-warming' })

    expect(await leasingAdapter.getLeaseStatuses([leaseId])).toEqual({
      ok: false,
      err: 'cache-warming',
    })
  })

  it('returns unknown on any other answer', async () => {
    nock(serviceUrl).post('/leases/statuses').reply(500, 'boom')

    expect(await leasingAdapter.getLeaseStatuses([leaseId])).toEqual({
      ok: false,
      err: 'unknown',
    })
  })

  it('returns unknown, never ok, when a 200 does not parse', async () => {
    nock(serviceUrl)
      .post('/leases/statuses')
      .reply(200, { content: { statuses: [{ leaseId }] } })

    expect(await leasingAdapter.getLeaseStatuses([leaseId])).toEqual({
      ok: false,
      err: 'unknown',
    })
  })
})
