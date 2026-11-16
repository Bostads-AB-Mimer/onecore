import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import nock from 'nock'
import { LeaseStatus, LeaseType, leasing } from '@onecore/types'
import { logger } from '@onecore/utilities'

import { routes } from '../../index'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import * as tenantLeaseAdapter from '../../adapters/xpand/tenant-lease-adapter'
import {
  TenfastInvoiceRow,
  YearMonthDayStringSchema,
} from '../../adapters/tenfast/schemas'
import * as tenfastLeaseSearchAdapter from '../../adapters/tenfast/tenfast-lease-search-adapter'
import {
  homeInsuranceCache,
  HomeInsuranceCacheRead,
} from '../../services/home-insurance-cache'
import * as factory from '../factories'
import config from '../../../../common/config'
import { schemas } from '@onecore/types'

jest.mock('../../adapters/xpand/ended-lease-adapter', () => ({
  getEndedLeasesByContactCode: jest.fn(async () => ({ ok: true, data: [] })),
  getEndedLeasesByRentalObjectCode: jest.fn(async () => ({
    ok: true,
    data: [],
  })),
  getEndedLeaseById: jest.fn(async () => ({ ok: false, err: 'not-found' })),
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(() => {
  jest.clearAllMocks()
})
nock(config.tenfast.baseUrl).get(`/v1/auth`).reply(200)

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /leases/by-contact-code/:contactCode', () => {
  it('returns 200 with empty array when contact is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: true, data: null })

    const res = await request(app.callback()).get(
      '/leases/by-contact-code/P965339'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
  })

  it('returns 500 when fetching contact fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: false, err: 'could-not-retrieve-tenant' })

    const res = await request(app.callback()).get(
      '/leases/by-contact-code/P965339'
    )

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('could-not-retrieve-tenant')
  })

  it('returns 200 with leases when contact is found', async () => {
    const tenant = factory.tenfastTenant.build()
    const lease = factory.tenfastLease.build()
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: true, data: tenant })
    jest
      .spyOn(tenfastAdapter, 'getLeasesByTenantId')
      .mockResolvedValueOnce({ ok: true, data: [lease] })

    const res = await request(app.callback()).get(
      '/leases/by-contact-code/P965339'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
  })

  it('does not look up sublet leases unless asked to', async () => {
    const tenant = factory.tenfastTenant.build()
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: true, data: tenant })
    jest
      .spyOn(tenfastAdapter, 'getLeasesByTenantId')
      .mockResolvedValueOnce({ ok: true, data: [] })
    const getSubletLeasesSpy = jest.spyOn(tenfastAdapter, 'getSubletLeases')

    await request(app.callback()).get(
      `/leases/by-contact-code/${tenant.externalId}`
    )

    expect(getSubletLeasesSpy).not.toHaveBeenCalled()
  })

  describe('with includeSubletLeases=true', () => {
    const tenant = factory.tenfastTenant.build()
    const url = (query = '') =>
      `/leases/by-contact-code/${tenant.externalId}?includeSubletLeases=true${query}`
    const leaseIds = (res: request.Response) =>
      res.body.content.map((l: { leaseId: string }) => l.leaseId)

    it('appends leases where the contact is the sublet tenant', async () => {
      const own = factory.tenfastLease.build()
      const sublet = factory.tenfastLease.build({
        andraHandHG: { externalId: tenant.externalId },
      })
      jest
        .spyOn(tenfastAdapter, 'getTenantByContactCode')
        .mockResolvedValueOnce({ ok: true, data: tenant })
      jest
        .spyOn(tenfastAdapter, 'getLeasesByTenantId')
        .mockResolvedValueOnce({ ok: true, data: [own] })
      const getSubletLeasesSpy = jest
        .spyOn(tenfastAdapter, 'getSubletLeases')
        .mockResolvedValueOnce({ ok: true, data: [sublet] })

      const res = await request(app.callback()).get(url())

      expect(res.status).toBe(200)
      expect(getSubletLeasesSpy).toHaveBeenCalledWith(
        tenant.externalId,
        undefined
      )
      expect(leaseIds(res)).toEqual([own.externalId, sublet.externalId])
      expect(res.body.content[1].subletContactId).toBe(tenant.externalId)
    })

    it('returns sublet leases for a contact with no Tenfast tenant record', async () => {
      const sublet = factory.tenfastLease.build()
      jest
        .spyOn(tenfastAdapter, 'getTenantByContactCode')
        .mockResolvedValueOnce({ ok: true, data: null })
      const getLeasesByTenantIdSpy = jest.spyOn(
        tenfastAdapter,
        'getLeasesByTenantId'
      )
      jest
        .spyOn(tenfastAdapter, 'getSubletLeases')
        .mockResolvedValueOnce({ ok: true, data: [sublet] })

      const res = await request(app.callback()).get(url())

      expect(res.status).toBe(200)
      expect(getLeasesByTenantIdSpy).not.toHaveBeenCalled()
      expect(leaseIds(res)).toEqual([sublet.externalId])
    })

    it('returns a lease once when it is both a first-hand and a sublet lease', async () => {
      const lease = factory.tenfastLease.build()
      jest
        .spyOn(tenfastAdapter, 'getTenantByContactCode')
        .mockResolvedValueOnce({ ok: true, data: tenant })
      jest
        .spyOn(tenfastAdapter, 'getLeasesByTenantId')
        .mockResolvedValueOnce({ ok: true, data: [lease] })
      jest
        .spyOn(tenfastAdapter, 'getSubletLeases')
        .mockResolvedValueOnce({ ok: true, data: [lease] })

      const res = await request(app.callback()).get(url())

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
    })

    it('passes the status filter on to the sublet lookup', async () => {
      jest
        .spyOn(tenfastAdapter, 'getTenantByContactCode')
        .mockResolvedValueOnce({ ok: true, data: tenant })
      jest
        .spyOn(tenfastAdapter, 'getLeasesByTenantId')
        .mockResolvedValueOnce({ ok: true, data: [] })
      const getSubletLeasesSpy = jest
        .spyOn(tenfastAdapter, 'getSubletLeases')
        .mockResolvedValueOnce({ ok: true, data: [] })

      await request(app.callback()).get(url('&status=current'))

      expect(getSubletLeasesSpy).toHaveBeenCalledWith(tenant.externalId, {
        status: ['current'],
      })
    })

    it('returns 500 when the sublet lookup fails', async () => {
      jest
        .spyOn(tenfastAdapter, 'getTenantByContactCode')
        .mockResolvedValueOnce({ ok: true, data: tenant })
      jest.spyOn(tenfastAdapter, 'getLeasesByTenantId').mockResolvedValueOnce({
        ok: true,
        data: [factory.tenfastLease.build()],
      })
      jest
        .spyOn(tenfastAdapter, 'getSubletLeases')
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(url())

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('unknown')
    })
  })
})

describe('POST /leases/:leaseId/preliminary-termination', () => {
  const validRequestBody = {
    contactCode: 'P12345',
    lastDebitDate: '2025-12-31T00:00:00.000Z',
    desiredMoveDate: '2025-12-31T00:00:00.000Z',
  }

  it('should return 400 if contactCode is missing', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        lastDebitDate: '2025-12-31T00:00:00.000Z',
        desiredMoveDate: '2025-12-31T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body.data).toMatchObject([
      {
        message: 'Required',
        path: ['contactCode'],
      },
    ])
  })

  it('should return 400 if lastDebitDate is missing', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        contactCode: 'P12345',
        desiredMoveDate: '2025-12-31T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body.data).toMatchObject([
      {
        message: 'Required',
        path: ['lastDebitDate'],
      },
    ])
  })

  it('should return 400 if desiredMoveDate is missing', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        contactCode: 'P12345',
        lastDebitDate: '2025-12-31T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body.data).toMatchObject([
      {
        message: 'Required',
        path: ['desiredMoveDate'],
      },
    ])
  })

  it('should return 400 if lastDebitDate is not a valid datetime', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        contactCode: 'P12345',
        lastDebitDate: 'invalid-date',
        desiredMoveDate: '2025-12-31T00:00:00.000Z',
      })

    expect(res.status).toBe(400)
    expect(res.body.data).toMatchObject([
      {
        message: 'Invalid datetime',
        path: ['lastDebitDate'],
      },
    ])
  })

  it('should return 400 if desiredMoveDate is not a valid datetime', async () => {
    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send({
        contactCode: 'P12345',
        lastDebitDate: '2025-12-31T00:00:00.000Z',
        desiredMoveDate: 'invalid-date',
      })

    expect(res.status).toBe(400)
    expect(res.body.data).toMatchObject([
      {
        message: 'Invalid datetime',
        path: ['desiredMoveDate'],
      },
    ])
  })

  it('should return 404 if lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: false,
        err: 'lease-not-found',
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({
      error: 'lease-not-found',
      message: 'Lease not found',
    })
  })

  it('should return 500 if termination fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: false,
        err: 'termination-failed',
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      error: 'termination-failed',
      message: 'Failed to terminate lease',
    })
  })

  it('should return 500 for unknown errors', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: false,
        err: 'unknown',
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      error: 'unknown',
      message: 'Failed to terminate lease',
    })
  })

  it('should return 200 and success message when termination succeeds', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: true,
        data: { message: 'Signerings begäran skickad' },
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      content: { message: 'Signerings begäran skickad' },
    })
  })

  it('should handle leaseId with special characters', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: true,
        data: { message: 'Signerings begäran skickad' },
      })

    const res = await request(app.callback())
      .post('/leases/216-704-00-0022%2F02/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(200)
    expect(tenfastAdapter.preliminaryTerminateLease).toHaveBeenCalledWith(
      '216-704-00-0022/02',
      'P12345',
      new Date('2025-12-31T00:00:00.000Z'),
      new Date('2025-12-31T00:00:00.000Z'),
      'Uppsägning av hyresgäst'
    )
  })

  it('should convert ISO datetime strings to Date objects', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: true,
        data: { message: 'Signerings begäran skickad' },
      })

    const res = await request(app.callback())
      .post('/leases/123-456/preliminary-termination')
      .send(validRequestBody)

    expect(res.status).toBe(200)
    expect(tenfastAdapter.preliminaryTerminateLease).toHaveBeenCalledWith(
      '123-456',
      'P12345',
      expect.any(Date),
      expect.any(Date),
      'Uppsägning av hyresgäst'
    )
  })

  it('should pass a given reason on to the adapter', async () => {
    jest
      .spyOn(tenfastAdapter, 'preliminaryTerminateLease')
      .mockResolvedValueOnce({
        ok: true,
        data: { message: 'Signerings begäran skickad' },
      })

    const res = await request(app.callback())
      .post('/leases/234-567/preliminary-termination')
      .send({ ...validRequestBody, reason: 'Flyttar till annan ort' })

    expect(res.status).toBe(200)
    expect(tenfastAdapter.preliminaryTerminateLease).toHaveBeenCalledWith(
      '234-567',
      'P12345',
      expect.any(Date),
      expect.any(Date),
      'Flyttar till annan ort'
    )
  })

  it('should return 400 if reason is blank', async () => {
    const res = await request(app.callback())
      .post('/leases/234-567/preliminary-termination')
      .send({ ...validRequestBody, reason: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.data).toMatchObject([{ path: ['reason'] }])
  })

  it('should return 400 if reason is longer than 60 characters', async () => {
    const res = await request(app.callback())
      .post('/leases/234-567/preliminary-termination')
      .send({ ...validRequestBody, reason: 'a'.repeat(61) })

    expect(res.status).toBe(400)
    expect(res.body.data).toMatchObject([{ path: ['reason'] }])
  })
})

const HOME_INSURANCE_ARTICLE_ID =
  config.tenfast.leaseRentRows.homeInsurance.articleId

const day = (value: string) => YearMonthDayStringSchema.parse(value)

const homeInsuranceRow = (
  overrides: Partial<TenfastInvoiceRow> = {}
): TenfastInvoiceRow =>
  factory.tenfastInvoiceRow.build({
    article: HOME_INSURANCE_ARTICLE_ID,
    label: 'Hemförsäkring',
    amount: 93,
    vat: 0,
    ...overrides,
  })

const mockLeaseRead = (hyror: TenfastInvoiceRow[]) =>
  jest.spyOn(tenfastAdapter, 'getLeaseByExternalId').mockResolvedValueOnce({
    ok: true,
    data: factory.tenfastLease.build({ hyror }),
  })

describe('POST /leases/:leaseId/home-insurance', () => {
  it('returns 404 lease-not-found when lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('lease-not-found')
  })

  it('returns 503 upstream-failed when fetching lease fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(503)
    expect(result.body.error).toBe('upstream-failed')
  })

  it('returns 422 when home insurance already exists and is not cancelled', async () => {
    mockLeaseRead([homeInsuranceRow()])

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(422)
    expect(result.body.error).toBe('home-insurance-already-exists')
  })

  it('returns 503 upstream-failed when creating rent row fails', async () => {
    mockLeaseRead([])
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'upstream-failed' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(503)
    expect(result.body.error).toBe('upstream-failed')
  })

  it('adds home insurance rent row with correct article, amount and vat', async () => {
    mockLeaseRead([])
    // The lease as read back after the write.
    mockLeaseRead([
      homeInsuranceRow({ from: day('2024-01-01'), to: null, amount: 100 }),
    ])

    const createInvoiceRowSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(201)
    expect(result.body.content).toEqual(null)
    expect(createInvoiceRowSpy).toHaveBeenCalledTimes(1)
    expect(createInvoiceRowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rowsToAdd: expect.arrayContaining([
          expect.objectContaining({
            amount: 100,
            article: HOME_INSURANCE_ARTICLE_ID,
            label: 'Hemförsäkring',
            vat: 0,
          }),
        ]),
        rowsToDelete: [],
      })
    )
  })
})

describe('GET /leases/:leaseId/home-insurance', () => {
  it('returns 404 lease-not-found when lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await request(app.callback()).get(
      '/leases/123/home-insurance'
    )

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('lease-not-found')
  })

  it('returns 503 upstream-failed when fetching lease fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback()).get(
      '/leases/123/home-insurance'
    )

    expect(result.status).toBe(503)
    expect(result.body.error).toBe('upstream-failed')
  })

  it('returns 404 home-insurance-row-not-found when rent row is missing', async () => {
    mockLeaseRead([])

    const result = await request(app.callback()).get(
      '/leases/123/home-insurance'
    )

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('home-insurance-row-not-found')
  })

  it('returns the row in force with its rowId, not an ended row listed before it', async () => {
    const current = homeInsuranceRow({
      _id: 'current',
      from: day('2021-01-01'),
      to: null,
    })
    mockLeaseRead([
      homeInsuranceRow({ from: day('2020-01-01'), to: day('2020-12-31') }),
      current,
    ])

    const result = await request(app.callback()).get(
      '/leases/123/home-insurance'
    )

    expect(result.status).toBe(200)
    expect(leasing.HomeInsuranceRowSchema.parse(result.body.content)).toEqual({
      rowId: 'current',
      monthlyAmount: current.amount,
      from: '2021-01-01',
    })
    expect(() =>
      schemas.v1.LeaseHomeInsuranceSchema.parse(result.body.content)
    ).not.toThrow()
  })
})

describe('POST /leases/:leaseId/home-insurance/cancel', () => {
  it('ends the row on endDate and returns null', async () => {
    const row = homeInsuranceRow({ from: day('2024-01-01'), to: null })
    mockLeaseRead([row])
    mockLeaseRead([{ ...row, _id: 'new', to: day('2024-10-01') }])

    const replaceInvoiceRowSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })

    // Mina sidor sends the day without a time zone.
    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: '2024-10-01T00:00:00' })

    expect(result.status).toBe(200)
    expect(result.body.content).toEqual(null)
    expect(replaceInvoiceRowSpy).toHaveBeenCalledWith({
      leaseId: '123',
      rowsToDelete: [row._id],
      rowsToAdd: [
        {
          amount: row.amount,
          vat: row.vat,
          article: row.article,
          label: row.label,
          from: '2024-01-01',
          to: '2024-10-01',
        },
      ],
    })
  })

  it('keeps the row and ends it on its first day when endDate is before it', async () => {
    const row = homeInsuranceRow({ from: day('2026-12-01'), to: null })
    mockLeaseRead([row])
    mockLeaseRead([{ ...row, _id: 'new', to: day('2026-12-01') }])
    const replaceInvoiceRowSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: '2026-11-15T00:00:00' })

    expect(result.status).toBe(200)
    expect(replaceInvoiceRowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rowsToDelete: [row._id],
        rowsToAdd: [
          expect.objectContaining({ from: '2026-12-01', to: '2026-12-01' }),
        ],
      })
    )
  })

  it('still answers 200 but logs the new rows when the rows after the write differ', async () => {
    // Someone else ended the row at the same time, so the lease now holds
    // both writes' rows.
    const row = homeInsuranceRow({
      _id: 'row',
      from: day('2024-01-01'),
      to: null,
    })
    mockLeaseRead([row])
    mockLeaseRead([
      { ...row, _id: 'theirs', to: day('2024-11-30') },
      { ...row, _id: 'ours', to: day('2024-10-01') },
    ])
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation()

    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: '2024-10-01T00:00:00' })

    expect(result.status).toBe(200)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseId: '123',
        addedRowIds: ['theirs', 'ours'],
      }),
      expect.any(String)
    )
  })

  it('returns 400 when endDate is missing', async () => {
    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({})

    expect(result.status).toBe(400)
  })

  it('returns 404 lease-not-found when lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: '2024-10-01T00:00:00' })

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('lease-not-found')
  })

  it('returns 404 home-insurance-row-not-found when the lease has no row', async () => {
    mockLeaseRead([])

    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: '2024-10-01T00:00:00' })

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('home-insurance-row-not-found')
  })

  it('returns 409 home-insurance-row-changed when Tenfast refuses the write because the row is gone', async () => {
    const row = homeInsuranceRow({ _id: 'old', from: day('2024-01-01') })
    mockLeaseRead([row])
    // Someone else replaced the row before this write.
    mockLeaseRead([{ ...row, _id: 'theirs' }])
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'bad-request' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: '2024-10-01T00:00:00' })

    expect(result.status).toBe(409)
    expect(result.body.error).toBe('home-insurance-row-changed')
  })

  it('returns 503 upstream-failed when the write fails', async () => {
    mockLeaseRead([homeInsuranceRow()])
    const replaceInvoiceRowSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'upstream-failed' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: '2024-10-01T00:00:00' })

    expect(result.status).toBe(503)
    expect(result.body.error).toBe('upstream-failed')
    expect(replaceInvoiceRowSpy).toHaveBeenCalled()
  })
})

describe('PATCH /leases/:leaseId/home-insurance/rows/:rowId', () => {
  const old = homeInsuranceRow({
    _id: 'old',
    from: day('2026-12-01'),
    to: null,
  })

  const patch = (body: object, rowId = 'old') =>
    request(app.callback())
      .patch(`/leases/123/home-insurance/rows/${rowId}`)
      .send(body)

  it('ends the row on endDate and returns the new row', async () => {
    const written = { ...old, _id: 'new', to: day('2027-03-31') }
    mockLeaseRead([old])
    mockLeaseRead([written])
    const updateSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(200)
    expect(
      leasing.UpdateHomeInsuranceRowResponseSchema.parse(result.body.content)
    ).toEqual({
      action: 'ended',
      row: {
        rowId: 'new',
        monthlyAmount: old.amount,
        from: '2026-12-01',
        to: '2027-03-31',
      },
    })
    expect(updateSpy).toHaveBeenCalledWith({
      leaseId: '123',
      rowsToDelete: ['old'],
      rowsToAdd: [
        {
          amount: old.amount,
          vat: old.vat,
          article: old.article,
          label: old.label,
          from: '2026-12-01',
          to: '2027-03-31',
        },
      ],
    })
  })

  it('removes the row when cancelled on or before its first day', async () => {
    mockLeaseRead([old])
    mockLeaseRead([])
    const updateSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })

    const result = await patch({ endDate: '2026-12-01', action: 'cancel' })

    expect(result.status).toBe(200)
    expect(result.body.content).toEqual({ action: 'deleted', row: null })
    expect(updateSpy).toHaveBeenCalledWith({
      leaseId: '123',
      rowsToDelete: ['old'],
      rowsToAdd: [],
    })
  })

  it('returns 400 for an endDate with a time, unlike the Mina sidor cancel', async () => {
    const readSpy = jest.spyOn(tenfastAdapter, 'getLeaseByExternalId')

    const result = await patch({
      endDate: '2027-03-31T00:00:00',
      action: 'cancel',
    })

    expect(result.status).toBe(400)
    expect(readSpy).not.toHaveBeenCalled()
  })

  it('returns 400 end-date-before-start for set-end before the first day', async () => {
    mockLeaseRead([old])
    const updateSpy = jest.spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')

    const result = await patch({ endDate: '2026-11-30', action: 'set-end' })

    expect(result.status).toBe(400)
    expect(result.body.error).toBe('end-date-before-start')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('returns 404 lease-not-found when lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('lease-not-found')
  })

  it('returns 404 home-insurance-row-not-found when the lease has no row', async () => {
    mockLeaseRead([factory.tenfastInvoiceRow.build()])

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('home-insurance-row-not-found')
  })

  it('returns 409 home-insurance-row-changed when no row has the rowId', async () => {
    mockLeaseRead([{ ...old, _id: 'other' }])
    const updateSpy = jest.spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(409)
    expect(result.body.error).toBe('home-insurance-row-changed')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('returns 404 lease-not-found when Tenfast has no lease on the write', async () => {
    mockLeaseRead([old])
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('lease-not-found')
  })

  it('returns 409 home-insurance-row-changed, with nothing written, when Tenfast refuses the write because the row is gone', async () => {
    mockLeaseRead([old])
    // Someone else replaced the row between this read and the write.
    mockLeaseRead([{ ...old, _id: 'theirs', to: day('2027-01-31') }])
    const updateSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'bad-request' })

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(409)
    expect(result.body.error).toBe('home-insurance-row-changed')
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  it('returns 503 upstream-failed when Tenfast refuses the write and the lease cannot be read again', async () => {
    mockLeaseRead([old])
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'bad-request' })

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(503)
    expect(result.body.error).toBe('upstream-failed')
  })

  it('returns 503 upstream-failed when Tenfast refuses the write and the row is still there', async () => {
    mockLeaseRead([old])
    // A 400 is looked into by reading the lease again: the row is still there.
    mockLeaseRead([old])
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'bad-request' })

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(503)
    expect(result.body.error).toBe('upstream-failed')
  })

  it('returns 409 home-insurance-row-changed when someone else changed the rows during the write', async () => {
    // Someone else ended the row first; Tenfast then took the stale id and
    // added this write's row next to theirs.
    mockLeaseRead([old])
    mockLeaseRead([
      { ...old, _id: 'theirs', to: day('2027-01-31') },
      { ...old, _id: 'ours', to: day('2027-03-31') },
    ])
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })
    const errorSpy = jest.spyOn(logger, 'error')

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(409)
    expect(result.body.error).toBe('home-insurance-row-changed')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    // The rows the write may have duplicated, for someone to look at.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ addedRowIds: ['theirs', 'ours'] }),
      expect.any(String)
    )
  })

  it('returns 503 upstream-failed when the lease cannot be read after the write', async () => {
    mockLeaseRead([old])
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })

    const result = await patch({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(503)
    expect(result.body.error).toBe('upstream-failed')
  })
})

describe('POST /leases', () => {
  const validRequestBody = {
    parkingSpaceId: 'P123',
    contactCode: 'P965339',
    fromDate: '2026-06-01T00:00:00.000Z',
    companyCode: '001',
    includeVAT: false,
  }

  it('returns 200 and lease content when lease is created successfully', async () => {
    const contact = factory.contact.build()
    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: contact })
    jest
      .spyOn(tenfastAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: true, data: '216-704-00-0022/02' })

    const res = await request(app.callback())
      .post('/leases')
      .send(validRequestBody)

    expect(res.status).toBe(200)
    expect(res.body.content).toBe('216-704-00-0022/02')
  })

  it('returns 404 when contact is not found', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: null })

    const res = await request(app.callback())
      .post('/leases')
      .send(validRequestBody)

    expect(res.status).toBe(404)
  })

  it('returns 404 when fetching contact fails', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback())
      .post('/leases')
      .send(validRequestBody)

    expect(res.status).toBe(404)
  })

  it('returns 500 when creating lease fails', async () => {
    const contact = factory.contact.build()
    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: contact })
    jest
      .spyOn(tenfastAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: false, err: 'lease-could-not-be-created' })

    const res = await request(app.callback())
      .post('/leases')
      .send(validRequestBody)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('lease-could-not-be-created')
  })

  it('returns 400 without creating a lease when fromDate is not a valid date', async () => {
    const createLeaseSpy = jest.spyOn(tenfastAdapter, 'createLease')

    const res = await request(app.callback())
      .post('/leases')
      .send({ ...validRequestBody, fromDate: 'not-a-date' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-from-date')
    expect(createLeaseSpy).not.toHaveBeenCalled()
    createLeaseSpy.mockRestore()
  })

  it('returns 409 when the rental object is not available', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(tenfastAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: false, err: 'rental-object-not-available' })

    const res = await request(app.callback())
      .post('/leases')
      .send(validRequestBody)

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('rental-object-not-available')
  })

  it('calls createLease with correct arguments', async () => {
    const contact = factory.contact.build({ contactCode: 'P965339' })
    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: contact })
    const createLeaseSpy = jest
      .spyOn(tenfastAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: true, data: '216-704-00-0022/02' })

    await request(app.callback()).post('/leases').send(validRequestBody)

    expect(createLeaseSpy).toHaveBeenCalledWith(
      contact,
      'P123',
      new Date('2026-06-01T00:00:00.000Z'),
      false
    )
  })

  it('returns 500 when an unexpected exception is thrown', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockRejectedValueOnce(new Error('Unexpected error'))

    const res = await request(app.callback())
      .post('/leases')
      .send(validRequestBody)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Unexpected error')
  })
})

describe('POST /leases/batch', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns leases from Tenfast mapped like GET /leases/:leaseId', async () => {
    const current = factory.tenfastLease.build({
      externalId: '216-704-00-0022/02',
      stage: 'active',
    })
    const pending = factory.tenfastLease.build({
      externalId: '306-001-01-0101/01',
      stage: 'signingInProgress',
    })
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValueOnce({ ok: true, data: current })
      .mockResolvedValueOnce({ ok: true, data: pending })
    const xpandSpy = jest.spyOn(tenantLeaseAdapter, 'getLeases')

    const res = await request(app.callback())
      .post('/leases/batch')
      .send({ leaseIds: [current.externalId, pending.externalId] })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      expect.objectContaining({
        leaseId: '216-704-00-0022/02',
        status: LeaseStatus.Current,
      }),
      expect.objectContaining({
        leaseId: '306-001-01-0101/01',
        status: LeaseStatus.PendingSignature,
      }),
    ])
    expect(xpandSpy).not.toHaveBeenCalled()
  })

  it('leaves out leases Tenfast cannot find or fails to fetch', async () => {
    const lease = factory.tenfastLease.build({
      externalId: '216-704-00-0022/02',
    })
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
      .mockResolvedValueOnce({ ok: true, data: lease })

    const res = await request(app.callback())
      .post('/leases/batch')
      .send({ leaseIds: ['missing/01', 'broken/01', lease.externalId] })

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0].leaseId).toBe('216-704-00-0022/02')
  })

  it('returns a repeated lease id once', async () => {
    const lease = factory.tenfastLease.build({
      externalId: '216-704-00-0022/02',
    })
    const getLeaseSpy = jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValue({ ok: true, data: lease })

    const res = await request(app.callback())
      .post('/leases/batch')
      .send({ leaseIds: [lease.externalId, lease.externalId] })

    expect(res.status).toBe(200)
    expect(getLeaseSpy).toHaveBeenCalledTimes(1)
    expect(res.body.content).toHaveLength(1)
  })

  it('fetches every lease, at most 10 at a time', async () => {
    const leaseIds = Array.from({ length: 25 }, (_, i) => `lease-${i}/01`)
    let inFlight = 0
    let maxInFlight = 0
    const getLeaseSpy = jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockImplementation(async (leaseId) => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setImmediate(resolve))
        inFlight--
        return {
          ok: true,
          data: factory.tenfastLease.build({ externalId: leaseId }),
        }
      })

    const res = await request(app.callback())
      .post('/leases/batch')
      .send({ leaseIds })

    expect(res.status).toBe(200)
    expect(getLeaseSpy).toHaveBeenCalledTimes(25)
    expect(maxInFlight).toBe(10)
    expect(res.body.content.map((l: { leaseId: string }) => l.leaseId)).toEqual(
      leaseIds
    )
  })

  it('returns 500 when no lease came back and a lookup failed', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback())
      .post('/leases/batch')
      .send({ leaseIds: ['missing/01', 'broken/01'] })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Could not get leases from Tenfast')
  })

  it('returns 200 with an empty list when no lease is found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValue({ ok: false, err: 'not-found' })

    const res = await request(app.callback())
      .post('/leases/batch')
      .send({ leaseIds: ['missing/01', 'missing/02'] })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
  })

  it('returns 500 when a lookup throws', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await request(app.callback())
      .post('/leases/batch')
      .send({ leaseIds: ['216-704-00-0022/02'] })

    expect(res.status).toBe(500)
  })

  it.each([
    ['a string', { leaseIds: '216-704-00-0022/02' }],
    ['a number', { leaseIds: 5 }],
    ['missing', {}],
  ])('returns 400 when leaseIds is %s', async (_, body) => {
    const getLeaseSpy = jest.spyOn(tenfastAdapter, 'getLeaseByLeaseId')

    const res = await request(app.callback()).post('/leases/batch').send(body)

    expect(res.status).toBe(400)
    expect(getLeaseSpy).not.toHaveBeenCalled()
  })
})

describe('GET /leases/search', () => {
  it('should return 400 for invalid query parameters', async () => {
    const res = await request(app.callback()).get(
      '/leases/search?limit=invalid'
    )

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid query parameters')
  })

  it('should return 200 with paginated results', async () => {
    const mockResult = {
      content: [
        {
          leaseId: 'test-lease-1',
          objectTypeCode: 'Bostad',
          leaseType: LeaseType.HousingContract,
          contacts: [
            { name: 'Test', contactCode: 'P123456', email: null, phone: null },
          ],
          address: 'Testgatan 1',
          rentalObjectCode: '123-456-00-0001',
          postalCode: null,
          city: null,
          startDate: new Date('2024-01-01'),
          endDate: null,
          lastDebitDate: null,
          signedAt: null,
          status: LeaseStatus.Current,
        },
      ],
      _meta: {
        totalRecords: 1,
        page: 1,
        limit: 20,
        count: 1,
      },
      _links: [],
    }

    jest
      .spyOn(tenfastLeaseSearchAdapter, 'searchLeases')
      .mockResolvedValueOnce(mockResult)

    const res = await request(app.callback()).get('/leases/search')

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0].leaseId).toBe('test-lease-1')
    expect(res.body._meta.totalRecords).toBe(1)
  })

  it('should pass query parameters to searchLeases', async () => {
    const searchSpy = jest
      .spyOn(tenfastLeaseSearchAdapter, 'searchLeases')
      .mockResolvedValueOnce({
        content: [],
        _meta: { totalRecords: 0, page: 1, limit: 20, count: 0 },
        _links: [],
      })

    await request(app.callback()).get(
      '/leases/search?q=test&status=current&page=2&limit=10'
    )

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'test',
        status: ['current'],
        page: 2,
        limit: 10,
      }),
      expect.anything()
    )
  })

  it('should return 500 when searchLeases throws', async () => {
    jest
      .spyOn(tenfastLeaseSearchAdapter, 'searchLeases')
      .mockRejectedValueOnce(new Error('Failed to fetch leases from Tenfast'))

    const res = await request(app.callback()).get('/leases/search')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to fetch leases from Tenfast')
  })

  it('should return 503 with Retry-After header when the cache is warming up', async () => {
    jest.spyOn(tenfastLeaseSearchAdapter, 'searchLeases').mockRejectedValueOnce(
      Object.assign(new Error('Lease cache is warming up — retry shortly'), {
        status: 503,
        headers: { 'Retry-After': '30' },
      })
    )

    const res = await request(app.callback()).get('/leases/search')

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('30')
    expect(res.body.error).toBe('Lease cache is warming up — retry shortly')
  })
})

describe('GET /leases/lf-export', () => {
  it('returns 200 with mapped rows on success', async () => {
    const lease = factory.tenfastLease.build({
      stage: 'active',
      hyresgaster: [
        factory.tenfastTenant.build({ idbeteckning: '199001011234' }),
      ],
      hyresobjekt: [factory.tenfastRentalObject.build()],
      hyror: [
        factory.tenfastInvoiceRow.build({
          article: config.tenfast.leaseRentRows.homeInsurance.articleId,
          to: null,
        }),
      ],
    })

    jest
      .spyOn(tenfastAdapter, 'getLeasesWithHomeInsurance')
      .mockResolvedValueOnce({ ok: true, data: [lease] })

    const res = await request(app.callback()).get('/leases/lf-export')

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0].leaseStatus).toBe('G')
  })

  it('returns 500 when adapter returns error', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeasesWithHomeInsurance')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get('/leases/lf-export')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('unknown')
  })
})

describe('GET /leases/home-insurances', () => {
  const tenant = factory.tenfastTenant.build({
    externalId: 'P000001',
    idbeteckning: '199001011234',
    name: { first: 'Anna', last: 'Svensson' },
    phone: '0701234567',
    invoiceEmail: 'anna@example.com',
  })
  const leaseWithRow = (externalId: string, address: string) =>
    factory.tenfastLease.build({
      externalId,
      stage: 'active',
      hyresgaster: [tenant],
      hyresobjekt: [
        factory.tenfastRentalObject.build({
          externalId: `RO-${externalId}`,
          postadress: address,
        }),
      ],
      hyror: [homeInsuranceRow({ _id: `row-${externalId}`, to: null })],
    })
  const leases = [
    leaseWithRow('L3', 'Ängsvägen 1'),
    leaseWithRow('L1', 'Zetagatan 1'),
    leaseWithRow('L2', 'Andgatan 1'),
  ]

  const mockCache = (read: HomeInsuranceCacheRead) =>
    jest.spyOn(homeInsuranceCache, 'getLeases').mockResolvedValueOnce(read)

  it('returns a page of items, sorted and filtered, with links that keep the query', async () => {
    mockCache({ ok: true, leases })
    const leaseByIdSpy = jest.spyOn(tenfastAdapter, 'getLeaseByLeaseId')

    const res = await request(app.callback()).get(
      '/leases/home-insurances?sortBy=address&sortOrder=asc&limit=2&status=G'
    )

    expect(res.status).toBe(200)
    expect(res.body._meta).toEqual({
      totalRecords: 3,
      page: 1,
      limit: 2,
      count: 2,
    })
    expect(
      res.body.content.map(
        (item: unknown) =>
          leasing.HomeInsuranceListItemSchema.parse(item).address
      )
    ).toEqual(['Andgatan 1', 'Zetagatan 1'])
    const next = res.body._links.find(
      (link: { rel: string }) => link.rel === 'next'
    )
    expect(next.href).toContain('page=2')
    expect(next.href).toContain('sortBy=address')
    expect(next.href).toContain('status=G')
    // Not taken for GET /leases/:leaseId.
    expect(leaseByIdSpy).not.toHaveBeenCalled()
  })

  it('carries the contactCode and no person data', async () => {
    mockCache({ ok: true, leases })

    const res = await request(app.callback()).get('/leases/home-insurances')

    expect(res.status).toBe(200)
    expect(res.body.content[0].contactCode).toBe('P000001')
    const body = JSON.stringify(res.body)
    expect(body).not.toContain('199001011234')
    expect(body).not.toContain('Svensson')
    expect(body).not.toContain('0701234567')
    expect(body).not.toContain('anna@example.com')
  })

  it('returns 200 with an empty list when nothing matches', async () => {
    mockCache({ ok: true, leases })

    const res = await request(app.callback()).get(
      '/leases/home-insurances?q=no-such-lease'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([])
    expect(res.body._meta.totalRecords).toBe(0)
  })

  it('returns 400 invalid-query for a sort on a person field', async () => {
    const cacheSpy = jest.spyOn(homeInsuranceCache, 'getLeases')

    const res = await request(app.callback()).get(
      '/leases/home-insurances?sortBy=fullName'
    )

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-query')
    expect(cacheSpy).not.toHaveBeenCalled()
  })

  it('returns 503 cache-warming with Retry-After while the list loads', async () => {
    mockCache({ ok: false, err: 'cache-warming' })

    const res = await request(app.callback()).get('/leases/home-insurances')

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('30')
    expect(res.body.error).toBe('cache-warming')
  })
})

describe('GET /leases/home-insurances/all', () => {
  const leaseWithRow = (externalId: string) =>
    factory.tenfastLease.build({
      externalId,
      stage: 'active',
      hyror: [homeInsuranceRow({ _id: `row-${externalId}`, to: null })],
    })
  const leases = Array.from({ length: 600 }, (_, index) =>
    leaseWithRow(`L${String(index).padStart(3, '0')}`)
  )

  it('returns every matching item, sorted, from one read of the cache', async () => {
    const cacheSpy = jest
      .spyOn(homeInsuranceCache, 'getLeases')
      .mockResolvedValueOnce({ ok: true, leases })

    const res = await request(app.callback()).get(
      '/leases/home-insurances/all?rows=all&sortOrder=desc'
    )

    expect(res.status).toBe(200)
    // More than the list's largest page.
    expect(res.body.content).toHaveLength(600)
    expect(res.body.content[0].leaseId).toBe('L599')
    expect(res.body._meta).toBeUndefined()
    expect(cacheSpy).toHaveBeenCalledTimes(1)
  })

  it('returns 400 invalid-query for an invalid query', async () => {
    const res = await request(app.callback()).get(
      '/leases/home-insurances/all?rows=some'
    )

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid-query')
  })

  it('returns 503 cache-warming with Retry-After while the list loads', async () => {
    jest
      .spyOn(homeInsuranceCache, 'getLeases')
      .mockResolvedValueOnce({ ok: false, err: 'cache-warming' })

    const res = await request(app.callback()).get('/leases/home-insurances/all')

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('30')
    expect(res.body.error).toBe('cache-warming')
  })
})

describe('POST /leases/statuses', () => {
  const cachedLease = (
    leaseId: string,
    status: LeaseStatus
  ): leasing.v1.LeaseSearchResult => ({
    leaseId,
    objectTypeCode: 'Bostad',
    leaseType: LeaseType.HousingContract,
    contacts: [],
    address: null,
    postalCode: null,
    city: null,
    startDate: null,
    endDate: null,
    lastDebitDate: null,
    signedAt: null,
    status,
    rentalObjectCode: null,
  })

  it('returns the status of each lease and the ones Tenfast does not have', async () => {
    jest
      .spyOn(tenfastLeaseSearchAdapter, 'readFreshLeaseCache')
      .mockResolvedValueOnce([cachedLease('L1', LeaseStatus.Current)])
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback())
      .post('/leases/statuses')
      .send({ leaseIds: ['L1', 'L2'] })

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({
      statuses: [{ leaseId: 'L1', status: LeaseStatus.Current }],
      notFoundLeaseIds: ['L2'],
    })
  })

  it('returns 400 when leaseIds is missing', async () => {
    const res = await request(app.callback()).post('/leases/statuses').send({})

    expect(res.status).toBe(400)
  })

  it('returns 503 cache-warming with Retry-After while the lease cache loads', async () => {
    jest
      .spyOn(tenfastLeaseSearchAdapter, 'readFreshLeaseCache')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback())
      .post('/leases/statuses')
      .send({ leaseIds: ['L1'] })

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('30')
    expect(res.body.error).toBe('cache-warming')
  })

  it('returns 503 upstream-failed when a lease cannot be read', async () => {
    jest.spyOn(logger, 'error').mockImplementation()
    jest
      .spyOn(tenfastLeaseSearchAdapter, 'readFreshLeaseCache')
      .mockResolvedValueOnce([])
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const res = await request(app.callback())
      .post('/leases/statuses')
      .send({ leaseIds: ['L1'] })

    expect(res.status).toBe(503)
    expect(res.body.error).toBe('upstream-failed')
  })
})

describe('home insurance list write-through', () => {
  it('makes the list reload and still answers 200 when the lease cannot be read after a cancel', async () => {
    mockLeaseRead([homeInsuranceRow({ from: day('2024-01-01'), to: null })])
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })
    const invalidateSpy = jest.spyOn(homeInsuranceCache, 'invalidate')

    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: '2024-10-01T00:00:00' })

    expect(result.status).toBe(200)
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it('puts the lease as read after a PATCH in the list, also when the check fails', async () => {
    const old = homeInsuranceRow({
      _id: 'old',
      from: day('2026-12-01'),
      to: null,
    })
    const after = factory.tenfastLease.build({
      hyror: [{ ...old, _id: 'other', to: day('2027-01-31') }],
    })
    mockLeaseRead([old])
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: true, data: after })
    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })
    const replaceSpy = jest.spyOn(homeInsuranceCache, 'replaceLease')

    const result = await request(app.callback())
      .patch('/leases/123/home-insurance/rows/old')
      .send({ endDate: '2027-03-31', action: 'set-end' })

    expect(result.status).toBe(409)
    expect(replaceSpy).toHaveBeenCalledWith(after)
  })
})
