import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import nock from 'nock'
import { LeaseStatus } from '@onecore/types'

import { routes } from '../../index'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import * as endedLeaseAdapter from '../../adapters/xpand/ended-lease-adapter'
import * as factory from '../factories'
import config from '../../../../common/config'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

nock(config.tenfast.baseUrl).get(`/v1/auth`).reply(200)

beforeEach(() => {
  jest.restoreAllMocks()
})

const xpandLease = (leaseId: string) =>
  factory.lease.build({ leaseId, status: LeaseStatus.Ended })

const ids = (res: request.Response) =>
  res.body.content.map((l: { leaseId: string }) => l.leaseId)

describe('GET /leases/by-contact-code/:contactCode with Xpand ended leases', () => {
  const tenant = factory.tenfastTenant.build()
  const url = (query = '') => `/leases/by-contact-code/P123456${query}`

  it('adds Xpand ended leases to the Tenfast leases', async () => {
    const own = factory.tenfastLease.build({ externalId: '111-111-111/01' })
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValue({ ok: true, data: tenant })
    jest
      .spyOn(tenfastAdapter, 'getLeasesByTenantId')
      .mockResolvedValue({ ok: true, data: [own] })
    const xpandSpy = jest
      .spyOn(endedLeaseAdapter, 'getEndedLeasesByContactCode')
      .mockResolvedValue({ ok: true, data: [xpandLease('222-222-222/02')] })

    const res = await request(app.callback()).get(url())

    expect(res.status).toBe(200)
    expect(xpandSpy).toHaveBeenCalledWith('P123456')
    expect(ids(res)).toEqual(['111-111-111/01', '222-222-222/02'])
  })

  it('shows a lease in both sources once, with the Tenfast status', async () => {
    const own = factory.tenfastLease.build({ externalId: '111-111-111/01' })
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValue({ ok: true, data: tenant })
    jest
      .spyOn(tenfastAdapter, 'getLeasesByTenantId')
      .mockResolvedValue({ ok: true, data: [own] })
    jest
      .spyOn(endedLeaseAdapter, 'getEndedLeasesByContactCode')
      .mockResolvedValue({ ok: true, data: [xpandLease('111-111-111/01')] })

    const res = await request(app.callback()).get(url())

    expect(ids(res)).toEqual(['111-111-111/01'])
    expect(res.body.content[0].status).not.toBe(LeaseStatus.Ended)
  })

  it('returns Xpand ended leases when Tenfast has no such tenant', async () => {
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(endedLeaseAdapter, 'getEndedLeasesByContactCode')
      .mockResolvedValue({ ok: true, data: [xpandLease('222-222-222/02')] })

    const res = await request(app.callback()).get(url())

    expect(res.status).toBe(200)
    expect(ids(res)).toEqual(['222-222-222/02'])
  })

  it('reads from Xpand when the status filter includes ended', async () => {
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValue({ ok: true, data: tenant })
    jest
      .spyOn(tenfastAdapter, 'getLeasesByTenantId')
      .mockResolvedValue({ ok: true, data: [] })
    const xpandSpy = jest
      .spyOn(endedLeaseAdapter, 'getEndedLeasesByContactCode')
      .mockResolvedValue({ ok: true, data: [xpandLease('222-222-222/02')] })

    const res = await request(app.callback()).get(url('?status=current,ended'))

    expect(xpandSpy).toHaveBeenCalledTimes(1)
    expect(ids(res)).toEqual(['222-222-222/02'])
  })

  it('skips Xpand when the status filter excludes ended', async () => {
    jest
      .spyOn(tenfastAdapter, 'getTenantByContactCode')
      .mockResolvedValue({ ok: true, data: tenant })
    jest
      .spyOn(tenfastAdapter, 'getLeasesByTenantId')
      .mockResolvedValue({ ok: true, data: [] })
    const xpandSpy = jest
      .spyOn(endedLeaseAdapter, 'getEndedLeasesByContactCode')
      .mockResolvedValue({ ok: true, data: [xpandLease('222-222-222/02')] })

    const res = await request(app.callback()).get(url('?status=current'))

    expect(xpandSpy).not.toHaveBeenCalled()
    expect(res.body.content).toEqual([])
  })
})

describe('GET /leases/by-rental-object-code/:rentalObjectCode with Xpand ended leases', () => {
  const url = (query = '') => `/leases/by-rental-object-code/123-456-789${query}`
  const rentalObject = factory.tenfastRentalObject.build()

  const mockTenfast = (leases: any[]) => {
    jest
      .spyOn(tenfastAdapter, 'getRentalObject')
      .mockResolvedValue({ ok: true, data: rentalObject })
    jest
      .spyOn(tenfastAdapter, 'getLeasesByRentalPropertyId')
      .mockResolvedValue({ ok: true, data: leases })
  }

  it('adds Xpand ended leases to the Tenfast leases', async () => {
    mockTenfast([factory.tenfastLease.build({ externalId: '111-111-111/01' })])
    const xpandSpy = jest
      .spyOn(endedLeaseAdapter, 'getEndedLeasesByRentalObjectCode')
      .mockResolvedValue({ ok: true, data: [xpandLease('222-222-222/02')] })

    const res = await request(app.callback()).get(url())

    expect(res.status).toBe(200)
    expect(xpandSpy).toHaveBeenCalledWith('123-456-789')
    expect(ids(res)).toEqual(['111-111-111/01', '222-222-222/02'])
  })

  it('shows a lease in both sources once, with the Tenfast status', async () => {
    mockTenfast([factory.tenfastLease.build({ externalId: '111-111-111/01' })])
    jest
      .spyOn(endedLeaseAdapter, 'getEndedLeasesByRentalObjectCode')
      .mockResolvedValue({ ok: true, data: [xpandLease('111-111-111/01')] })

    const res = await request(app.callback()).get(url())

    expect(ids(res)).toEqual(['111-111-111/01'])
    expect(res.body.content[0].status).not.toBe(LeaseStatus.Ended)
  })

  it('skips Xpand when the status filter excludes ended', async () => {
    mockTenfast([])
    const xpandSpy = jest
      .spyOn(endedLeaseAdapter, 'getEndedLeasesByRentalObjectCode')
      .mockResolvedValue({ ok: true, data: [xpandLease('222-222-222/02')] })

    const res = await request(app.callback()).get(url('?status=current'))

    expect(xpandSpy).not.toHaveBeenCalled()
    expect(res.body.content).toEqual([])
  })
})

describe('GET /leases/:leaseId with Xpand ended leases', () => {
  it('returns the Xpand lease when Tenfast does not have it', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValue({ ok: false, err: 'not-found' })
    jest
      .spyOn(endedLeaseAdapter, 'getEndedLeaseById')
      .mockResolvedValue({ ok: true, data: xpandLease('222-222-222/02') })

    const res = await request(app.callback()).get('/leases/222-222-222%2F02')

    expect(res.status).toBe(200)
    expect(res.body.content.leaseId).toBe('222-222-222/02')
    expect(res.body.content.status).toBe(LeaseStatus.Ended)
  })

  it('returns the Tenfast lease and ignores Xpand when both have it', async () => {
    jest.spyOn(tenfastAdapter, 'getLeaseByLeaseId').mockResolvedValue({
      ok: true,
      data: factory.tenfastLease.build({ externalId: '111-111-111/01' }),
    })
    jest
      .spyOn(endedLeaseAdapter, 'getEndedLeaseById')
      .mockResolvedValue({ ok: true, data: xpandLease('111-111-111/01') })

    const res = await request(app.callback()).get('/leases/111-111-111%2F01')

    expect(res.status).toBe(200)
    expect(res.body.content.status).not.toBe(LeaseStatus.Ended)
  })

  it('returns 404 when neither source has the lease', async () => {
    jest
      .spyOn(tenfastAdapter, 'getLeaseByLeaseId')
      .mockResolvedValue({ ok: false, err: 'not-found' })
    jest
      .spyOn(endedLeaseAdapter, 'getEndedLeaseById')
      .mockResolvedValue({ ok: false, err: 'not-found' })

    const res = await request(app.callback()).get('/leases/999-999-999%2F01')

    expect(res.status).toBe(404)
  })
})
