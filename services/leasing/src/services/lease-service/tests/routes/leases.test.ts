import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../index'
import * as tenantLeaseAdapter from '../../adapters/xpand/tenant-lease-adapter'
import * as xpandSoapAdapter from '../../adapters/xpand/xpand-soap-adapter'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('GET /getLeasesForNationalRegistrationNumber', () => {
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

describe('GET /getLeasesForContactCode', () => {
  it('responds with an array of leases', async () => {
    const leaseMock = factory.lease.buildList(3)
    const getLeasesSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLeasesForContactCode')
      .mockResolvedValueOnce({ ok: true, data: leaseMock })

    const res = await request(app.callback()).get(
      '/leases/for/contactCode/P965339'
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toBeInstanceOf(Array)
    expect(getLeasesSpy).toHaveBeenCalled()
    expect(res.body.content.length).toBe(3)
  })
})

describe('GET /getLeasesForPropertyId', () => {
  it('responds with an array of leases', async () => {
    const leaseMock = factory.lease.buildList(3)
    const getLeasesSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
      .mockResolvedValueOnce(leaseMock)

    const res = await request(app.callback()).get(
      '/leases/for/propertyId/110-007-01-0203'
    )
    expect(res.status).toBe(200)
    expect(res.body.content).toBeInstanceOf(Array)
    expect(getLeasesSpy).toHaveBeenCalled()
    expect(res.body.content.length).toBe(3)
  })
})

describe('GET /leases/:id', () => {
  it('responds with a lease', async () => {
    const leaseMock = factory.lease.build()
    const getLeaseSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLease')
      .mockResolvedValueOnce(leaseMock)

    const res = await request(app.callback()).get('/leases/1337')
    expect(res.status).toBe(200)
    expect(getLeaseSpy).toHaveBeenCalled()

    expect(res.body.content.leaseId).toEqual(leaseMock.leaseId)
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
