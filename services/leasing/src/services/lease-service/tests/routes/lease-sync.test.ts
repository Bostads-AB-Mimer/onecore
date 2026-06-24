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
  getSuboccupantsForLease: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../adapters/xpand/lease-document-adapter', () => ({
  getSignedContractPdf: jest.fn().mockResolvedValue(null),
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

const getLeases = jest.spyOn(tenantLeaseAdapter, 'getLeases')
const getSuboccupantsForLease = jest.spyOn(
  tenantLeaseAdapter,
  'getSuboccupantsForLease'
)
const getLeaseChanges = jest.spyOn(cmlogLeaseAdapter, 'getLeaseChanges')
const importLease = jest.spyOn(tenfastAdapter, 'importLease')
const terminateLease = jest.spyOn(tenfastAdapter, 'terminateLease')
const voidLease = jest.spyOn(tenfastAdapter, 'voidLease')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /leases/sync', () => {
  it('returns 200 with changes when valid since param', async () => {
    const change = factory.leaseChange.build()

    getLeaseChanges.mockResolvedValueOnce([change])

    const res = await request(app.callback()).get(
      '/leases/sync?since=2024-01-01T00:00:00.000Z'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      { ...change, timestamp: change.timestamp.toISOString() },
    ])
  })

  it('returns 200 with changes when no since param (fallback)', async () => {
    const change = factory.leaseChange.build()

    getLeaseChanges.mockResolvedValueOnce([change])

    const res = await request(app.callback()).get('/leases/sync')

    expect(res.status).toBe(200)
    expect(res.body.content[0].timestamp).toBe(change.timestamp.toISOString())
    expect(getLeaseChanges).toHaveBeenCalledWith(null)
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
      .send({ contact: factory.syncTenantPayload.build(), action: 'create' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when action is missing', async () => {
    const res = await request(app.callback()).post('/leases/sync').send({
      leaseId: '123-456/01',
      contact: factory.syncTenantPayload.build(),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when action is not in the enum', async () => {
    const res = await request(app.callback()).post('/leases/sync').send({
      leaseId: '123-456/01',
      contact: factory.syncTenantPayload.build(),
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
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          leaseStartDate: new Date('2026-01-01'),
        }),
      ])
      importLease.mockResolvedValueOnce({
        ok: true,
        data: { _id: 'tenfast-id' },
      })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'create',
      })

      expect(res.status).toBe(201)
      expect(res.body.content).toEqual({
        action: 'created',
        leaseId: '123-456/01',
      })
    })

    it('returns 404 when xpand lease not found on create', async () => {
      getLeases.mockResolvedValueOnce([])

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'create',
      })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Lease not found in xpand')
    })

    it('returns 400 when xpand lease has no leaseStartDate', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          leaseStartDate: undefined as unknown as Date,
        }),
      ])

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'create',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('xpand lease has no leaseStartDate')
    })

    it('returns 500 when importLease fails', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          leaseStartDate: new Date('2026-01-01'),
        }),
      ])
      importLease.mockResolvedValueOnce({
        ok: false,
        err: 'lease-could-not-be-created',
      })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'create',
      })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('lease-could-not-be-created')
    })

    it('calls getSuboccupantsForLease after successful create', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          leaseStartDate: new Date('2026-01-01'),
        }),
      ])
      importLease.mockResolvedValueOnce({
        ok: true,
        data: { _id: 'tenfast-id' },
      })
      getSuboccupantsForLease.mockResolvedValueOnce([
        {
          leaseId: '123-456/01',
          contactCode: 'P123456',
          name: 'Test Person',
          fromDate: new Date('2025-01-01'),
          toDate: null,
        },
      ])

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'create',
      })

      expect(res.status).toBe(201)
      expect(getSuboccupantsForLease).toHaveBeenCalledWith('123-456/01')
    })

    it('still returns 201 when getSuboccupantsForLease throws', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          leaseStartDate: new Date('2026-01-01'),
        }),
      ])
      importLease.mockResolvedValueOnce({
        ok: true,
        data: { _id: 'tenfast-id' },
      })
      getSuboccupantsForLease.mockRejectedValueOnce(new Error('xpand error'))

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'create',
      })

      expect(res.status).toBe(201)
    })
  })

  describe('action: terminate', () => {
    it('does not require contact for terminate', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          lastDebitDate: new Date('2026-04-30'),
        }),
      ])
      terminateLease.mockResolvedValueOnce({
        ok: true,
        data: { action: 'terminated', leaseId: '123-456/01' },
      })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({ leaseId: '123-456/01', action: 'terminate' })

      expect(res.status).toBe(200)
    })

    it('returns 200 with action "terminated" on success', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          lastDebitDate: new Date('2026-04-30'),
        }),
      ])
      terminateLease.mockResolvedValueOnce({
        ok: true,
        data: { action: 'terminated', leaseId: '123-456/01' },
      })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'terminate',
      })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'terminated',
        leaseId: '123-456/01',
      })
    })

    it('returns 404 when xpand lease not found', async () => {
      getLeases.mockResolvedValueOnce([])

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'terminate',
      })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Lease not found in xpand')
    })

    it('returns 400 when xpand lease has no lastDebitDate', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          lastDebitDate: undefined,
        }),
      ])

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'terminate',
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('xpand lease has no lastDebitDate')
    })

    it('returns 200 action "skipped" when tenfast lease not found', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          lastDebitDate: new Date('2026-04-30'),
        }),
      ])
      terminateLease.mockResolvedValueOnce({
        ok: false,
        err: 'lease-not-found',
      })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'terminate',
      })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'skipped',
        leaseId: '123-456/01',
      })
    })

    it('returns 200 action "skipped" when adapter returns already-terminated success', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          lastDebitDate: new Date('2026-04-30'),
        }),
      ])
      terminateLease.mockResolvedValueOnce({
        ok: true,
        data: { action: 'skipped', leaseId: '123-456/01' },
      })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'terminate',
      })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'skipped',
        leaseId: '123-456/01',
      })
    })

    it('returns 500 when terminate fails with non-idempotent error', async () => {
      getLeases.mockResolvedValueOnce([
        factory.lease.build({
          leaseId: '123-456/01',
          lastDebitDate: new Date('2026-04-30'),
        }),
      ])
      terminateLease.mockResolvedValueOnce({
        ok: false,
        err: 'terminate-failed',
      })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'terminate',
      })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('terminate-failed')
    })
  })

  describe('action: void', () => {
    it('does not require contact for void', async () => {
      voidLease.mockResolvedValueOnce({
        ok: true,
        data: { action: 'voided', leaseId: '123-456/01' },
      })

      const res = await request(app.callback())
        .post('/leases/sync')
        .send({ leaseId: '123-456/01', action: 'void' })

      expect(res.status).toBe(200)
    })

    it('returns 200 with action "voided" on success', async () => {
      voidLease.mockResolvedValueOnce({
        ok: true,
        data: { action: 'voided', leaseId: '123-456/01' },
      })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'void',
      })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'voided',
        leaseId: '123-456/01',
      })
    })

    it('returns 200 action "skipped" when tenfast lease not found', async () => {
      voidLease.mockResolvedValueOnce({ ok: false, err: 'lease-not-found' })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'void',
      })

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual({
        action: 'skipped',
        leaseId: '123-456/01',
      })
    })

    it('returns 500 when void fails', async () => {
      voidLease.mockResolvedValueOnce({ ok: false, err: 'void-failed' })

      const res = await request(app.callback()).post('/leases/sync').send({
        leaseId: '123-456/01',
        contact: factory.syncTenantPayload.build(),
        action: 'void',
      })

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('void-failed')
    })
  })
})
