import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../routes/lease-sync'
import * as tenfastAdapter from '../../adapters/tenfast/tenfast-adapter'
import * as cmlogLeaseAdapter from '../../adapters/xpand/cmlog-lease-adapter'
import * as tenantLeaseAdapter from '../../adapters/xpand/tenant-lease-adapter'
import * as factory from '../factories'

jest.mock('../../adapters/xpand/xpandDb', () => ({
  xpandDb: {},
}))

jest.mock('../../adapters/xpand/tenant-lease-adapter', () => ({
  getLeases: jest.fn(),
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
        action: 'create' as const,
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
        action: 'terminate' as const,
      },
    ]

    jest
      .spyOn(cmlogLeaseAdapter, 'getLeaseChanges')
      .mockResolvedValueOnce(mockChanges)

    const res = await request(app.callback()).get('/leases/sync')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(mockChanges)
    expect(cmlogLeaseAdapter.getLeaseChanges).toHaveBeenCalledWith(null)
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
      .send({ contact: factory.contact.build(), action: 'create' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when action is missing', async () => {
    const res = await request(app.callback())
      .post('/leases/sync')
      .send({ leaseId: '123-456/01', contact: factory.contact.build() })

    expect(res.status).toBe(400)
  })

  it('returns 400 when action is not in the enum', async () => {
    const res = await request(app.callback())
      .post('/leases/sync')
      .send({
        leaseId: '123-456/01',
        contact: factory.contact.build(),
        action: 'patch',
      })

    expect(res.status).toBe(400)
  })

  describe('action: create', () => {
    it('returns 400 when contact is missing for create', async () => {
      const res = await request(app.callback())
        .post('/leases/sync')
        .send({ leaseId: '123-456/01', action: 'create' })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('contact is required for action "create"')
    })

    it('returns 201 with action "created" on successful create', async () => {
      jest
        .spyOn(tenfastAdapter, 'createLease')
        .mockResolvedValueOnce({ ok: true, data: undefined })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'create',
        })

      expect(res.status).toBe(201)
      expect(res.body.content).toEqual({
        action: 'created',
        leaseId: '123-456/01',
      })
    })

    it('returns 500 when createLease fails', async () => {
      jest
        .spyOn(tenfastAdapter, 'createLease')
        .mockResolvedValueOnce({
          ok: false,
          err: 'lease-could-not-be-created',
        })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'create',
        })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('lease-could-not-be-created')
    })
  })

  describe('action: terminate', () => {
    it('does not require contact for terminate', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeases')
        .mockResolvedValueOnce([
          factory.lease.build({
            leaseId: '123-456/01',
            lastDebitDate: new Date('2026-04-30'),
          }),
        ])
      jest
        .spyOn(tenfastAdapter, 'terminateLease')
        .mockResolvedValueOnce({
          ok: true,
          data: { action: 'terminated', leaseId: '123-456/01' },
        })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({ leaseId: '123-456/01', action: 'terminate' })

      expect(res.status).toBe(200)
    })

    it('returns 200 with action "terminated" on success', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeases')
        .mockResolvedValueOnce([
          factory.lease.build({
            leaseId: '123-456/01',
            lastDebitDate: new Date('2026-04-30'),
          }),
        ])
      jest
        .spyOn(tenfastAdapter, 'terminateLease')
        .mockResolvedValueOnce({
          ok: true,
          data: { action: 'terminated', leaseId: '123-456/01' },
        })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'terminate',
        })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'terminated',
        leaseId: '123-456/01',
      })
    })

    it('returns 404 when xpand lease not found', async () => {
      jest.spyOn(tenantLeaseAdapter, 'getLeases').mockResolvedValueOnce([])

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'terminate',
        })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Lease not found in xpand')
    })

    it('returns 400 when xpand lease has no lastDebitDate', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeases')
        .mockResolvedValueOnce([
          factory.lease.build({
            leaseId: '123-456/01',
            lastDebitDate: undefined,
          }),
        ])

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'terminate',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('xpand lease has no lastDebitDate')
    })

    it('returns 200 action "skipped" when tenfast lease not found', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeases')
        .mockResolvedValueOnce([
          factory.lease.build({
            leaseId: '123-456/01',
            lastDebitDate: new Date('2026-04-30'),
          }),
        ])
      jest
        .spyOn(tenfastAdapter, 'terminateLease')
        .mockResolvedValueOnce({ ok: false, err: 'lease-not-found' })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'terminate',
        })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'skipped',
        leaseId: '123-456/01',
      })
    })

    it('returns 500 when terminate fails with non-idempotent error', async () => {
      jest
        .spyOn(tenantLeaseAdapter, 'getLeases')
        .mockResolvedValueOnce([
          factory.lease.build({
            leaseId: '123-456/01',
            lastDebitDate: new Date('2026-04-30'),
          }),
        ])
      jest
        .spyOn(tenfastAdapter, 'terminateLease')
        .mockResolvedValueOnce({ ok: false, err: 'terminate-failed' })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'terminate',
        })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('terminate-failed')
    })
  })

  describe('action: void', () => {
    it('does not require contact for void', async () => {
      jest
        .spyOn(tenfastAdapter, 'voidLease')
        .mockResolvedValueOnce({
          ok: true,
          data: { action: 'voided', leaseId: '123-456/01' },
        })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({ leaseId: '123-456/01', action: 'void' })

      expect(res.status).toBe(200)
    })

    it('returns 200 with action "voided" on success', async () => {
      jest
        .spyOn(tenfastAdapter, 'voidLease')
        .mockResolvedValueOnce({
          ok: true,
          data: { action: 'voided', leaseId: '123-456/01' },
        })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'void',
        })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'voided',
        leaseId: '123-456/01',
      })
    })

    it('returns 200 action "skipped" when tenfast lease not found', async () => {
      jest
        .spyOn(tenfastAdapter, 'voidLease')
        .mockResolvedValueOnce({ ok: false, err: 'lease-not-found' })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'void',
        })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'skipped',
        leaseId: '123-456/01',
      })
    })

    it('returns 500 when lease is signed (hard-fail)', async () => {
      jest
        .spyOn(tenfastAdapter, 'voidLease')
        .mockResolvedValueOnce({ ok: false, err: 'lease-signed' })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({
          leaseId: '123-456/01',
          contact: factory.contact.build(),
          action: 'void',
        })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('lease-signed')
    })
  })
})
