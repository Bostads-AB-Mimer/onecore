import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../index'
import * as tenantLeaseAdapter from '../../adapters/xpand/tenant-lease-adapter'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import * as xpandSoapAdapter from '../../adapters/xpand/xpand-soap-adapter'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe.skip('GET /getLeasesForNationalRegistrationNumber', () => {
  it('responds with an array of leases', async () => {
    const leaseMock = factory.lease.buildList(3)
    const getLeasesSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLeasesForNationalRegistrationNumber')
      .mockResolvedValueOnce(leaseMock)

    const res = await request(app.callback()).get(
      '/leases/for/nationalRegistrationNumber/194808075577'
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toBeInstanceOf(Array)
    expect(getLeasesSpy).toHaveBeenCalled()
    expect(res.body.content.length).toBe(3)
  })
})

describe('GET /leases/by-contact-code/:contactCode', () => {
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
