jest.mock('@onecore/utilities', () => {
  const actual = jest.requireActual('@onecore/utilities')
  return {
    ...actual,
    // createExcelExport lazy-loads exceljs via a dynamic import, which
    // requires --experimental-vm-modules under Jest's CJS transform.
    createExcelExport: jest.fn(),
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
      warn: () => {
        return
      },
      debug: () => {
        return
      },
    },
    generateRouteMetadata: jest.fn(),
    makeSuccessResponseBody: <T>(content: T, metadata: object) => ({
      content,
      ...metadata,
    }),
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { leasing, LeaseStatus } from '@onecore/types'
import * as utilities from '@onecore/utilities'

import { routes } from '../index'
import * as leasingAdapter from '../../../adapters/leasing-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

const row: leasing.v1.LeaseRentRowListItem = {
  leaseId: '000-000-00-0102/01',
  leaseStatus: LeaseStatus.Current,
  contactCodes: ['P0182914'],
  rowId: 'row-1',
  articleId: 'article-1',
  articleCode: 'HEMFÖR',
  label: 'Mimers hemförsäkring',
  amount: 92,
  from: '2026-11-05',
  to: null,
  isHomeInsurance: true,
  articleCreatedAt: null,
  articleUpdatedAt: null,
}

const rentRowsResponse: leasing.v1.LeaseRentRowsResponse = {
  content: [row],
  _meta: {
    totalRecords: 1,
    page: 1,
    limit: 100,
    count: 1,
    syncedAt: '2026-11-09T07:22:00.000Z',
  },
}

describe('GET /leases/rent-rows', () => {
  it('passes the parsed query to leasing and returns its answer', async () => {
    const spy = jest
      .spyOn(leasingAdapter, 'getLeaseRentRows')
      .mockResolvedValue({ ok: true, data: rentRowsResponse })

    const res = await request(app.callback()).get(
      '/leases/rent-rows?q=P0182914&status=current&status=upcoming&page=1&limit=100'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([row])
    expect(res.body._meta.syncedAt).toBe('2026-11-09T07:22:00.000Z')
    expect(spy).toHaveBeenCalledWith({
      q: 'P0182914',
      status: ['current', 'upcoming'],
      page: 1,
      limit: 100,
    })
  })

  it('returns 400 for an unknown status without calling leasing', async () => {
    const spy = jest.spyOn(leasingAdapter, 'getLeaseRentRows')

    const res = await request(app.callback()).get(
      '/leases/rent-rows?status=nope'
    )

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns 503 with Retry-After while leasing warms up', async () => {
    jest
      .spyOn(leasingAdapter, 'getLeaseRentRows')
      .mockResolvedValue({ ok: false, err: 'warming-up' })

    const res = await request(app.callback()).get('/leases/rent-rows')

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('30')
  })

  it('returns 500 when leasing fails', async () => {
    jest
      .spyOn(leasingAdapter, 'getLeaseRentRows')
      .mockResolvedValue({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get('/leases/rent-rows')
    expect(res.status).toBe(500)
  })
})

describe('GET /leases/rent-rows/export', () => {
  it('fetches every matching row (no page) and returns an Excel file', async () => {
    const spy = jest
      .spyOn(leasingAdapter, 'getLeaseRentRows')
      .mockResolvedValue({ ok: true, data: rentRowsResponse })
    jest
      .mocked(utilities.createExcelExport)
      .mockResolvedValue(Buffer.from('xlsx'))

    const res = await request(app.callback()).get(
      '/leases/rent-rows/export?filter=homeInsurance&page=3'
    )

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith({ filter: 'homeInsurance' })
    expect(utilities.createExcelExport).toHaveBeenCalledWith(
      expect.objectContaining({ sheetName: 'Avtalsrader', data: [row] })
    )
  })
})

describe('POST /leases/:leaseId/rent-rows/home-insurance-end-date', () => {
  const url = '/leases/L-1/rent-rows/home-insurance-end-date'

  it('changes the end date and returns the rows read back', async () => {
    const spy = jest
      .spyOn(leasingAdapter, 'setHomeInsuranceEndDate')
      .mockResolvedValue({
        ok: true,
        data: { changed: true, rentRows: [{ ...row, to: '2026-12-31' }] },
      })

    const res = await request(app.callback())
      .post(url)
      .send({ rowId: 'row-1', endDate: '2026-12-31' })

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith('L-1', {
      rowId: 'row-1',
      endDate: '2026-12-31',
    })
    expect(res.body.content.rentRows[0].to).toBe('2026-12-31')
  })

  it('returns 400 for a badly formatted date', async () => {
    const spy = jest.spyOn(leasingAdapter, 'setHomeInsuranceEndDate')

    const res = await request(app.callback())
      .post(url)
      .send({ rowId: 'row-1', endDate: '31/12/2026' })

    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it.each([
    ['not-home-insurance', 422],
    ['end-before-start', 422],
    ['unchanged', 422],
    ['row-not-found', 404],
    ['lease-not-found', 404],
    ['update-failed', 500],
  ] as const)('maps %s to %i', async (err, status) => {
    jest
      .spyOn(leasingAdapter, 'setHomeInsuranceEndDate')
      .mockResolvedValue({ ok: false, err })

    const res = await request(app.callback())
      .post(url)
      .send({ rowId: 'row-1', endDate: '2026-12-31' })

    expect(res.status).toBe(status)
    expect(res.body.error).toBe(err)
  })
})
