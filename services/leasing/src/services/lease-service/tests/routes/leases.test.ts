import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import nock from 'nock'

import { routes } from '../../index'
import * as tenantLeaseAdapter from '../../adapters/xpand/tenant-lease-adapter'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import * as xpandSoapAdapter from '../../adapters/xpand/xpand-soap-adapter'
import * as factory from '../factories'
import config from '../../../../common/config'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

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

  it('responds with 400 if query params are invalid', async () => {
    const res = await request(app.callback()).get(
      '/leases/by-contact-code/P965339?status=invalid'
    )

    expect(res.status).toBe(400)
  })

  it('responds with an array of leases', async () => {
    const leaseMock = factory.tenfastLease.buildList(3)
    const tenantMock = factory.tenfastTenant.build()
    const getTenantSpy = jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: true, data: tenantMock })

    const getLeasesSpy = jest
      .spyOn(tenfastAdapter, 'getLeasesByTenantId')
      .mockResolvedValueOnce({ ok: true, data: leaseMock })

    const res = await request(app.callback()).get(
      '/leases/by-contact-code/P965339'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toBeInstanceOf(Array)
    expect(getTenantSpy).toHaveBeenCalled()
    expect(getLeasesSpy).toHaveBeenCalled()
    expect(res.body.content.length).toBe(3)
  })

  it('includes contacts', async () => {
    const contacts = [factory.contact.build(), factory.contact.build()]

    const tenantMock = factory.tenfastTenant.build()
    const leaseMock = factory.tenfastLease.build({
      hyresgaster: [
        factory.tenfastTenant.build({ externalId: contacts[0].contactCode }),
        factory.tenfastTenant.build({ externalId: contacts[1].contactCode }),
      ],
    })

    const getTenantSpy = jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValueOnce({ ok: true, data: tenantMock })

    const getLeasesSpy = jest
      .spyOn(tenfastAdapter, 'getLeasesByTenantId')
      .mockResolvedValueOnce({ ok: true, data: [leaseMock] })

    const getContactSpy = jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: contacts[0] })
      .mockResolvedValueOnce({ ok: true, data: contacts[1] })

    const res = await request(app.callback()).get(
      '/leases/by-contact-code/P965339?includeContacts=true'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      expect.objectContaining({
        tenants: expect.arrayContaining([
          expect.objectContaining({ contactCode: contacts[0].contactCode }),
          expect.objectContaining({ contactCode: contacts[1].contactCode }),
        ]),
      }),
    ])

    expect(getTenantSpy).toHaveBeenCalled()
    expect(getLeasesSpy).toHaveBeenCalled()
    expect(getContactSpy).toHaveBeenCalled()
  })
})

describe('GET /leases/by-rental-object-code/:rentalObjectCode', () => {
  it('responds with an array of leases', async () => {
    const leaseMock = factory.tenfastLease.buildList(3)
    const rentalObjectMock = factory.tenfastRentalObject.build()

    const getRentalObjectSpy = jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValueOnce({ ok: true, data: rentalObjectMock })
    const getLeasesSpy = jest
      .spyOn(tenfastAdapter, 'getLeasesByRentalPropertyId')
      .mockResolvedValueOnce({ ok: true, data: leaseMock })

    const res = await request(app.callback()).get(
      '/leases/by-rental-object-code/110-007-01-0203'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toBeInstanceOf(Array)
    expect(getLeasesSpy).toHaveBeenCalled()
    expect(getRentalObjectSpy).toHaveBeenCalled()
    expect(res.body.content.length).toBe(3)
  })

  it('includes contacts', async () => {
    const contacts = [factory.contact.build(), factory.contact.build()]

    const leaseMock = factory.tenfastLease.build({
      hyresgaster: [
        factory.tenfastTenant.build({ externalId: contacts[0].contactCode }),
        factory.tenfastTenant.build({ externalId: contacts[1].contactCode }),
      ],
    })

    const rentalObjectMock = factory.tenfastRentalObject.build()

    const getRentalObjectSpy = jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValueOnce({ ok: true, data: rentalObjectMock })

    const getLeasesSpy = jest
      .spyOn(tenfastAdapter, 'getLeasesByRentalPropertyId')
      .mockResolvedValueOnce({ ok: true, data: [leaseMock] })

    const getContactSpy = jest
      .spyOn(tenantLeaseAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: contacts[0] })
      .mockResolvedValueOnce({ ok: true, data: contacts[1] })

    const res = await request(app.callback()).get(
      '/leases/by-rental-object-code/110-007-01-0203?includeContacts=true'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      expect.objectContaining({
        tenants: expect.arrayContaining([
          expect.objectContaining({ contactCode: contacts[0].contactCode }),
          expect.objectContaining({ contactCode: contacts[1].contactCode }),
        ]),
      }),
    ])

    expect(getLeasesSpy).toHaveBeenCalled()
    expect(getContactSpy).toHaveBeenCalled()
    expect(getRentalObjectSpy).toHaveBeenCalled()
  })
})

describe('GET /leases/:id', () => {
  it('responds with a lease', async () => {
    const leaseMock = factory.tenfastLease.build()
    const getLeaseSpy = jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValueOnce({ ok: true, data: leaseMock })

    const res = await request(app.callback()).get('/leases/1337')

    expect(res.status).toBe(200)
    expect(res.body.content).not.toBeNull()
    expect(getLeaseSpy).toHaveBeenCalled()
  })

  it('includes contacts', async () => {
    const leaseMock = factory.tenfastLease.build()
    const getLeaseSpy = jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValueOnce({ ok: true, data: leaseMock })

    const contacts = [factory.contact.build(), factory.contact.build()]

    const getContactSpy = jest
      .spyOn(tenantLeaseAdapter, 'getContactsByLeaseId')
      .mockResolvedValueOnce(contacts)

    const res = await request(app.callback()).get(
      '/leases/1337?includeContacts=true'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(
      expect.objectContaining({
        tenants: expect.arrayContaining([
          expect.objectContaining({ contactCode: contacts[0].contactCode }),
          expect.objectContaining({ contactCode: contacts[1].contactCode }),
        ]),
      })
    )
    expect(getLeaseSpy).toHaveBeenCalled()
    expect(getContactSpy).toHaveBeenCalled()
  })
})

describe('POST /leases', () => {
  it('calls xpand adapter and returns id of new lease', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: true, data: '123-123-123/1' })

    const result = await request(app.callback()).post('/leases')

    expect(xpandAdapterSpy).toHaveBeenCalled()
    expect(result.body.content).toEqual('123-123-123/1')
  })

  it('handles lease-not-found errors', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: false, err: 'create-lease-not-allowed' })

    const result = await request(app.callback()).post('/leases')

    expect(xpandAdapterSpy).toHaveBeenCalled()
    expect(result.status).toBe(404)
    expect(result.body.error).toBe(
      'Lease cannot be created on this rental object'
    )
  })

  it('handles unknown errors', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback()).post('/leases')

    expect(xpandAdapterSpy).toHaveBeenCalled()
    expect(result.status).toBe(500)
    expect(result.body.error).toBe('Unknown error when creating lease')
  })

  it('handles unhandled errors', async () => {
    const xpandAdapterSpy = jest
      .spyOn(xpandSoapAdapter, 'createLease')
      .mockImplementation(() => {
        throw new Error('Oh no')
      })

    const result = await request(app.callback()).post('/leases')

    expect(xpandAdapterSpy).toHaveBeenCalled()

    expect(result.body).toEqual({ error: 'Oh no' })
  })
})

describe('POST /leases/:leaseId/rent-rows/home-insurance', () => {
  it('returns 404 when lease is not found', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const result = await request(app.callback()).post(
      '/leases/123/rent-rows/home-insurance'
    )

    expect(result.status).toBe(404)
    expect(result.body.error).toBe('Lease not found')
  })

  it('returns 500 when fetching lease fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback()).post(
      '/leases/123/rent-rows/home-insurance'
    )

    expect(result.status).toBe(500)
  })

  it('returns 422 when home insurance already exists', async () => {
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

    const result = await request(app.callback()).post(
      '/leases/123/rent-rows/home-insurance'
    )

    expect(result.status).toBe(422)
    expect(result.body.error).toBe(
      'Home insurance rent row already exists for this lease'
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
      .spyOn(tenfastAdapter, 'createLeaseInvoiceRow')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback()).post(
      '/leases/123/rent-rows/home-insurance'
    )

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
      .spyOn(tenfastAdapter, 'createLeaseInvoiceRow')
      .mockResolvedValueOnce({ ok: true, data: null })

    const result = await request(app.callback()).post(
      '/leases/123/rent-rows/home-insurance'
    )

    expect(result.status).toBe(201)
    expect(result.body.content).toEqual(null)
    expect(createInvoiceRowSpy).toHaveBeenCalledTimes(1)
    expect(createInvoiceRowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseId: '123',
        invoiceRow: expect.objectContaining({
          amount: config.tenfast.leaseRentRows.homeInsurance.amount,
          article: config.tenfast.leaseRentRows.homeInsurance.articleId,
          label: 'Hemförsäkring',
          vat: 0,
          from: expect.any(String),
        }),
      })
    )
  })
})

describe('DELETE /leases/:leaseId/rent-rows/:rentRowId', () => {
  it('deletes and returns null', async () => {
    const deleteInvoiceRowSpy = jest
      .spyOn(tenfastAdapter, 'deleteLeaseInvoiceRow')
      .mockResolvedValueOnce({ ok: true, data: null })

    const result = await request(app.callback()).delete(
      '/leases/123/rent-rows/123'
    )

    expect(result.status).toBe(200)
    expect(result.body.content).toEqual(null)
    expect(deleteInvoiceRowSpy).toHaveBeenCalled()
  })

  it('returns 500 on error', async () => {
    const deleteInvoiceRowSpy = jest
      .spyOn(tenfastAdapter, 'deleteLeaseInvoiceRow')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await request(app.callback()).delete(
      '/leases/123/rent-rows/123'
    )

    expect(result.status).toBe(500)

    expect(deleteInvoiceRowSpy).toHaveBeenCalled()
  })
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /leases/:leaseId/preliminary-termination', () => {
  const validRequestBody = {
    contactCode: 'P12345',
    lastDebitDate: '2025-12-31T00:00:00.000Z',
    desiredMoveDate: '2025-12-31T00:00:00.000Z',
  }

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
