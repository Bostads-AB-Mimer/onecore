import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import nock from 'nock'

import { routes } from '../../index'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import { toYearMonthDayString } from '../../adapters/tenfast/schemas'
import * as factory from '../factories'
import config from '../../../../common/config'
import { schemas } from '@onecore/types'

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
  it('responds with 404 if tenant not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: true, data: null })

    const res = await request(app.callback()).get(
      '/leases/by-contact-code/P965339'
    )

    expect(res.status).toBe(404)
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
      new Date('2025-12-31T00:00:00.000Z')
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
      expect.any(Date)
    )
  })
})

describe('POST /leases/:leaseId/home-insurance', () => {
  it('returns 404 when lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('Lease not found')
  })

  it('returns 500 when fetching lease fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(500)
  })

  it('returns 422 when home insurance already exists and is not cancelled', async () => {
    const leaseWithHomeInsurance = factory.tenfastLease.build({
      hyror: [
        factory.tenfastInvoiceRow.build({
          article: config.tenfast.leaseRentRows.homeInsurance.articleId,
        }),
      ],
    })

    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: true, data: leaseWithHomeInsurance })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(422)
    expect(result.body.error).toBe(
      'Home insurance already exists and is not cancelled for this lease'
    )
  })

  it('returns 500 when creating rent row fails', async () => {
    const leaseWithoutHomeInsurance = factory.tenfastLease.build({
      hyror: [],
    })

    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: true, data: leaseWithoutHomeInsurance })

    jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance')
      .send({ from: new Date('2024-01-01'), monthlyAmount: 100 })

    expect(result.status).toBe(500)
  })

  it('adds home insurance rent row with correct article, amount and vat', async () => {
    const leaseWithoutHomeInsurance = factory.tenfastLease.build({
      hyror: [],
    })

    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: true, data: leaseWithoutHomeInsurance })

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
            article: config.tenfast.leaseRentRows.homeInsurance.articleId,
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
  it('returns 404 when lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await request(app.callback()).get(
      '/leases/123/home-insurance'
    )

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('Lease not found')
  })

  it('returns 500 when fetching lease fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback()).get(
      '/leases/123/home-insurance'
    )

    expect(result.status).toBe(500)
  })

  it('returns 404 when rent row is missing', async () => {
    const leaseWithoutHomeInsurance = factory.tenfastLease.build({
      hyror: [],
    })

    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: true, data: leaseWithoutHomeInsurance })

    const result = await request(app.callback()).get(
      '/leases/123/home-insurance'
    )

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('Home insurance not found')
  })

  it('returns home insurance with dates', async () => {
    const homeInsuranceRow = factory.tenfastInvoiceRow.build({
      article: config.tenfast.leaseRentRows.homeInsurance.articleId,
      from: toYearMonthDayString(new Date('2024-01-01')),
      to: toYearMonthDayString(new Date('2024-12-01')),
    })
    const leaseWithHomeInsurance = factory.tenfastLease.build({
      hyror: [homeInsuranceRow],
    })

    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: true, data: leaseWithHomeInsurance })

    const result = await request(app.callback()).get(
      '/leases/123/home-insurance'
    )

    expect(result.status).toBe(200)
    expect(() =>
      schemas.v1.LeaseHomeInsuranceSchema.parse(result.body.content)
    ).not.toThrow()
  })
})

describe('POST /leases/:leaseId/home-insurance/cancel', () => {
  it('cancels and returns null', async () => {
    const homeInsuranceRow = factory.tenfastInvoiceRow.build({
      article: config.tenfast.leaseRentRows.homeInsurance.articleId,
    })
    jest.spyOn(tenfastAdapter, 'getLeaseByExternalId').mockResolvedValueOnce({
      ok: true,
      data: factory.tenfastLease.build({
        hyror: [homeInsuranceRow],
      }),
    })

    const replaceInvoiceRowSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: true, data: null })

    const endDate = new Date('2024-10-01')
    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate })

    expect(result.status).toBe(200)
    expect(result.body.content).toEqual(null)
    expect(replaceInvoiceRowSpy).toHaveBeenCalledWith({
      leaseId: '123',
      rowsToDelete: [homeInsuranceRow._id],
      rowsToAdd: [
        {
          amount: homeInsuranceRow.amount,
          vat: homeInsuranceRow.vat,
          article: homeInsuranceRow.article,
          label: homeInsuranceRow.label,
          from: homeInsuranceRow.from ?? undefined,
          to: toYearMonthDayString(endDate),
        },
      ],
    })
  })

  it('returns 500 on error', async () => {
    jest.spyOn(tenfastAdapter, 'getLeaseByExternalId').mockResolvedValueOnce({
      ok: true,
      data: factory.tenfastLease.build({
        hyror: [
          factory.tenfastInvoiceRow.build({
            article: config.tenfast.leaseRentRows.homeInsurance.articleId,
          }),
        ],
      }),
    })

    const replaceInvoiceRowSpy = jest
      .spyOn(tenfastAdapter, 'updateLeaseInvoiceRows')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback())
      .post('/leases/123/home-insurance/cancel')
      .send({ endDate: new Date('2024-10-01') })

    expect(result.status).toBe(500)

    expect(replaceInvoiceRowSpy).toHaveBeenCalled()
  })
})
