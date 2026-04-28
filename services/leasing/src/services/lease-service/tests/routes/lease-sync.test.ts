import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/lease-sync'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import * as cmlogLeaseAdapter from '../../adapters/xpand/cmlog-lease-adapter'
import * as factory from '../factories'

jest.mock('../../adapters/xpand/xpandDb', () => ({
  xpandDb: {},
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /leases/sync', () => {
  it('returns 200 with changes when valid since param', async () => {
    const mockChanges = [
      {
        leaseId: '123-456/01',
        contactCode: 'P12345',
        rentalObjectId: '123-456',
      },
    ]

    jest
      .spyOn(cmlogLeaseAdapter, 'getLeaseChanges')
      .mockResolvedValueOnce(mockChanges)

    const res = await request(app.callback()).get(
      '/leases/sync?since=2024-01-01T00:00:00.000Z'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(mockChanges)
  })

  it('returns 200 with changes when no since param (fallback)', async () => {
    const mockChanges = [
      {
        leaseId: '789-012/02',
        contactCode: 'P67890',
        rentalObjectId: '789-012',
      },
    ]

    jest
      .spyOn(cmlogLeaseAdapter, 'getLeaseChanges')
      .mockResolvedValueOnce(mockChanges)

    const res = await request(app.callback()).get('/leases/sync')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(mockChanges)
    expect(cmlogLeaseAdapter.getLeaseChanges).toHaveBeenCalledWith(
      expect.anything(),
      null
    )
  })

  it('returns 400 when invalid since param', async () => {
    const res = await request(app.callback()).get(
      '/leases/sync?since=not-a-date'
    )

    expect(res.status).toBe(400)
    expect(res.body.error).toBe(
      'Invalid since parameter, expected ISO 8601 date'
    )
  })
})

describe('POST /leases/sync', () => {
  it('returns 400 when leaseId is missing', async () => {
    const res = await request(app.callback())
      .post('/leases/sync')
      .send({ contact: factory.contact.build() })

    expect(res.status).toBe(400)
  })

  it('returns 500 when contact is missing (passes schema but fails at runtime)', async () => {
    jest
      .spyOn(tenfastAdapter, 'getOrCreateAndUpdateTenant')
      .mockRejectedValueOnce(new Error('Cannot read contact'))

    const res = await request(app.callback())
      .post('/leases/sync')
      .send({ leaseId: '123-456/01' })

    expect(res.status).toBe(500)
  })

  it('returns 201 with action "created" on successful create', async () => {
    const contact = factory.contact.build()
    const mockTenant = factory.tenfastTenant.build()

    jest
      .spyOn(tenfastAdapter, 'getOrCreateAndUpdateTenant')
      .mockResolvedValueOnce({ ok: true, data: mockTenant })

    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    jest
      .spyOn(tenfastAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: true, data: undefined })

    const res = await request(app.callback())
      .post('/leases/sync')
      .send({ leaseId: '123-456/01', contact })

    expect(res.status).toBe(201)
    expect(res.body.action).toBe('created')
  })

  it('returns 200 with action "skipped" when lease already exists', async () => {
    const contact = factory.contact.build()
    const mockTenant = factory.tenfastTenant.build()
    const mockLease = factory.tenfastLease.build()

    jest
      .spyOn(tenfastAdapter, 'getOrCreateAndUpdateTenant')
      .mockResolvedValueOnce({ ok: true, data: mockTenant })

    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: true, data: mockLease })

    const res = await request(app.callback())
      .post('/leases/sync')
      .send({ leaseId: '123-456/01', contact })

    expect(res.status).toBe(200)
    expect(res.body.action).toBe('skipped')
  })

  it('returns 500 when tenant sync fails', async () => {
    const contact = factory.contact.build()

    jest
      .spyOn(tenfastAdapter, 'getOrCreateAndUpdateTenant')
      .mockResolvedValueOnce({ ok: false, err: 'could-not-retrieve-tenant' })

    const res = await request(app.callback())
      .post('/leases/sync')
      .send({ leaseId: '123-456/01', contact })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('could-not-retrieve-tenant')
  })

  it('returns 500 when lease creation fails', async () => {
    const contact = factory.contact.build()
    const mockTenant = factory.tenfastTenant.build()

    jest
      .spyOn(tenfastAdapter, 'getOrCreateAndUpdateTenant')
      .mockResolvedValueOnce({ ok: true, data: mockTenant })

    jest
      .spyOn(tenfastAdapter, 'getLeaseByExternalId')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    jest
      .spyOn(tenfastAdapter, 'createLease')
      .mockResolvedValueOnce({ ok: false, err: 'lease-could-not-be-created' })

    const res = await request(app.callback())
      .post('/leases/sync')
      .send({ leaseId: '123-456/01', contact })

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('lease-could-not-be-created')
  })
})
