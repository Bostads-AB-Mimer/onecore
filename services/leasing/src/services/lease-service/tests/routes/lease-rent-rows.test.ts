import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import nock from 'nock'
import { LeaseStatus, leasing } from '@onecore/types'

import { routes } from '../../index'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import * as tenfastLeaseSearchAdapter from '../../adapters/tenfast/tenfast-lease-search-adapter'
import type { CachedLease } from '../../../../common/lease-cache'
import type { YearMonthDayString } from '../../adapters/tenfast/schemas'
import * as factory from '../factories'
import config from '../../../../common/config'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

nock(config.tenfast.baseUrl).get(`/v1/auth`).reply(200)

const HOME_INSURANCE_ID = config.tenfast.leaseRentRows.homeInsurance.articleId
// Test dates are written as literal yyyy-mm-dd strings
const ymd = (s: string) => s as YearMonthDayString

const cachedLease = (
  leaseId: string,
  status: LeaseStatus,
  rowIds: string[]
): CachedLease =>
  ({
    leaseId,
    status,
    contacts: [
      { name: 'Test', contactCode: 'P000001', email: null, phone: null },
    ],
    rentRows: rowIds.map((id) => ({
      id,
      articleId: id.startsWith('ins') ? HOME_INSURANCE_ID : 'other',
      label: id,
      amount: 1,
      vat: 0,
      from: ymd('2026-01-01'),
    })),
    // Only the fields the rent row code reads; the rest of the search result is irrelevant here
  }) as CachedLease

beforeEach(() => {
  jest.restoreAllMocks()
  jest
    .spyOn(tenfastAdapter, 'getArticles')
    .mockResolvedValue([{ _id: HOME_INSURANCE_ID, code: 'HEMFÖR', vat: 0 }])
})

describe('GET /leases/rent-rows', () => {
  beforeEach(() => {
    jest
      .spyOn(tenfastLeaseSearchAdapter, 'readFreshLeaseCache')
      .mockResolvedValue([
        cachedLease('B-1', LeaseStatus.Current, ['ins-b', 'fee-b']),
        cachedLease('A-1', LeaseStatus.Ended, ['fee-a']),
      ])
  })

  it('returns all rows with article codes when no page is given', async () => {
    // Act
    const res = await request(app.callback()).get('/leases/rent-rows')

    // Assert
    expect(res.status).toBe(200)
    expect(
      res.body.content.map((r: leasing.v1.LeaseRentRowListItem) => r.rowId)
    ).toEqual(['fee-a', 'ins-b', 'fee-b'])
    expect(res.body.content[1]).toMatchObject({
      articleCode: 'HEMFÖR',
      isHomeInsurance: true,
    })
    expect(res.body._meta).toMatchObject({ totalRecords: 3, count: 3 })
  })

  it('filters on status and paginates', async () => {
    // Act
    const res = await request(app.callback()).get(
      '/leases/rent-rows?status=current&page=2&limit=1'
    )

    // Assert
    expect(res.status).toBe(200)
    expect(
      res.body.content.map((r: leasing.v1.LeaseRentRowListItem) => r.rowId)
    ).toEqual(['fee-b'])
    expect(res.body._meta).toMatchObject({
      totalRecords: 2,
      page: 2,
      limit: 1,
      count: 1,
    })
  })

  it('still returns rows when articles cannot be fetched', async () => {
    // Arrange
    jest
      .spyOn(tenfastAdapter, 'getArticles')
      .mockRejectedValue(new Error('down'))

    // Act
    const res = await request(app.callback()).get('/leases/rent-rows')

    // Assert
    expect(res.status).toBe(200)
    expect(res.body.content[0].articleCode).toBeNull()
  })

  it('returns 400 on an invalid status', async () => {
    // Act
    const res = await request(app.callback()).get(
      '/leases/rent-rows?status=nope'
    )

    // Assert
    expect(res.status).toBe(400)
  })

  it('returns 503 while the cache is warming up', async () => {
    // Arrange
    jest
      .spyOn(tenfastLeaseSearchAdapter, 'readFreshLeaseCache')
      .mockResolvedValue(undefined)

    // Act
    const res = await request(app.callback()).get('/leases/rent-rows')

    // Assert
    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('30')
  })
})

describe('POST /leases/:leaseId/rent-rows/home-insurance-end-date', () => {
  const insuranceRow = factory.tenfastInvoiceRow.build({
    _id: 'row-ins',
    article: HOME_INSURANCE_ID,
    from: ymd('2026-01-01'),
    to: null,
  })
  const feeRow = factory.tenfastInvoiceRow.build({
    _id: 'row-fee',
    article: 'other',
  })
  const lease = factory.tenfastLease.build({
    externalId: 'L-1',
    hyror: [insuranceRow, feeRow],
  })

  const post = (body: object) =>
    request(app.callback())
      .post('/leases/L-1/rent-rows/home-insurance-end-date')
      .send(body)

  it('replaces the home insurance row and returns the rows read back', async () => {
    // Arrange
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValue({ ok: true, data: lease })
    const updateSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValue({ ok: true, data: null })
    const cacheSpy = jest
      .spyOn(tenfastLeaseSearchAdapter, 'updateCachedLease')
      .mockReturnValue(cachedLease('L-1', LeaseStatus.Current, ['ins-new']))

    // Act
    const res = await post({ rowId: 'row-ins', endDate: '2026-12-31' })

    // Assert
    expect(res.status).toBe(200)
    expect(updateSpy).toHaveBeenCalledWith({
      leaseId: 'L-1',
      rowsToDelete: ['row-ins'],
      rowsToAdd: [
        {
          amount: insuranceRow.amount,
          vat: insuranceRow.vat,
          article: HOME_INSURANCE_ID,
          label: insuranceRow.label,
          from: '2026-01-01',
          to: '2026-12-31',
        },
      ],
    })
    expect(cacheSpy).toHaveBeenCalled()
    expect(res.body.content.changed).toBe(true)
    expect(
      res.body.content.rentRows.map(
        (r: leasing.v1.LeaseRentRowListItem) => r.rowId
      )
    ).toEqual(['ins-new'])
  })

  it('refuses other articles without calling Tenfast', async () => {
    // Arrange
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValue({ ok: true, data: lease })
    const updateSpy = jest.spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')

    // Act
    const res = await post({ rowId: 'row-fee', endDate: '2026-12-31' })

    // Assert
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('not-home-insurance')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown lease', async () => {
    // Arrange
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValue({ ok: false, err: 'not-found' })

    // Act
    const res = await post({ rowId: 'row-ins', endDate: '2026-12-31' })

    // Assert
    expect(res.status).toBe(404)
  })

  it('returns 400 for a badly formatted date', async () => {
    // Act
    const res = await post({ rowId: 'row-ins', endDate: '31/12/2026' })

    // Assert
    expect(res.status).toBe(400)
  })

  it('returns 500 when Tenfast refuses the change', async () => {
    // Arrange
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValue({ ok: true, data: lease })
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValue({ ok: false, err: 'upstream-failed' })

    // Act
    const res = await post({ rowId: 'row-ins', endDate: '2026-12-31' })

    // Assert
    expect(res.status).toBe(500)
  })
})
