jest.mock('@onecore/utilities', () => {
  const actual = jest.requireActual('@onecore/utilities')
  return {
    ...actual,
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    generateRouteMetadata: jest.fn(() => ({})),
    makeSuccessResponseBody: <T>(content: T, metadata: object) => ({
      content,
      ...metadata,
    }),
  }
})

jest.mock('../lease-exports/run-lease-export', () => ({
  ...jest.requireActual('../lease-exports/run-lease-export'),
  runLeaseExport: jest.fn(),
}))

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import type { FileListItem } from '@onecore/types'

import { routes } from '../index'
import * as fileStorageAdapter from '../../../adapters/file-storage-adapter'
import { leaseExportRegistry } from '../lease-exports/registry'
import { runLeaseExport } from '../lease-exports/run-lease-export'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-12T12:00:00.000Z')

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
// Simulate the Keycloak token: the user id (token sub) arrives in x-user-id.
app.use(async (ctx, next) => {
  ctx.state.user = { id: String(ctx.get('x-user-id')) }
  await next()
})
app.use(router.routes())

const asUserA = { 'x-user-id': 'user-a' }

let storage: FileListItem[]

const storedFile = (
  name: string,
  lastModified: Date,
  size = 1000
): FileListItem => ({
  name,
  lastModified: lastModified.toISOString(),
  etag: 'etag',
  size,
})

const at = (iso: string) => jest.setSystemTime(new Date(iso))

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'queueMicrotask',
      'hrtime',
      'performance',
    ],
  })
  leaseExportRegistry.clear()
  storage = []
  jest
    .spyOn(fileStorageAdapter, 'listFiles')
    .mockImplementation(async (prefix?: string) => ({
      ok: true,
      data: storage.filter((f) => f.name.startsWith(prefix ?? '')),
    }))
  jest
    .spyOn(fileStorageAdapter, 'deleteFile')
    .mockResolvedValue({ ok: true, data: undefined })
  jest.spyOn(fileStorageAdapter, 'getFileUrl').mockResolvedValue({
    ok: true,
    data: { url: 'https://files.example.test/signed', expiresIn: 300 },
  })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('POST /lease-exports', () => {
  it('starts an export in the background and answers 202 at once', async () => {
    const res = await request(app.callback())
      .post('/lease-exports?status=ended')
      .set(asUserA)

    expect(res.status).toBe(202)
    expect(res.body.content).toEqual({
      id: expect.any(String),
      status: 'running',
      phase: 'fetching-leases',
      statusFilter: ['ended'],
      leaseCount: null,
      startedAt: NOW.toISOString(),
      finishedAt: null,
      fileName: null,
      sizeBytes: null,
      expiresAt: null,
      failureReason: null,
    })
    expect(runLeaseExport).toHaveBeenCalledTimes(1)
    expect(runLeaseExport).toHaveBeenCalledWith(
      expect.objectContaining({
        id: res.body.content.id,
        userId: 'user-a',
        filters: expect.objectContaining({ status: 'ended' }),
      }),
      leaseExportRegistry
    )
  })

  it('answers 409 when the same user already has an export running', async () => {
    const first = await request(app.callback())
      .post('/lease-exports?status=ended')
      .set(asUserA)

    const second = await request(app.callback())
      .post('/lease-exports?status=ended')
      .set(asUserA)

    expect(second.status).toBe(409)
    expect(second.body).toMatchObject({
      reason: 'lease-export-already-running',
      exportId: first.body.content.id,
    })
    expect(runLeaseExport).toHaveBeenCalledTimes(1)
  })
})

describe('GET /lease-exports', () => {
  it("lists only the caller's running, failed and done exports, newest first", async () => {
    at('2026-11-10T08:00:00.000Z')
    const failedClaim = leaseExportRegistry.claim('user-a', {
      status: 'current',
    })
    if (!failedClaim.ok) throw new Error('claim failed')
    at('2026-11-10T08:01:00.000Z')
    leaseExportRegistry.fail(failedClaim.job.id, 'export-failed')

    at('2026-11-10T09:00:00.000Z')
    const doneClaim = leaseExportRegistry.claim('user-a', { status: 'ended' })
    if (!doneClaim.ok) throw new Error('claim failed')
    leaseExportRegistry.setPhase(doneClaim.job.id, 'fetching-contacts', 42)
    const doneKey = `lease-exports/user-a/${doneClaim.job.id}/hyreskontrakt-2026-11-10.xlsx`
    at('2026-11-10T09:05:00.000Z')
    leaseExportRegistry.complete(doneClaim.job.id, doneKey)
    storage.push(
      storedFile(doneKey, new Date('2026-11-10T09:05:00.000Z'), 12345)
    )

    at('2026-11-10T09:30:00.000Z')
    const otherClaim = leaseExportRegistry.claim('user-b', { status: 'ended' })
    if (!otherClaim.ok) throw new Error('claim failed')
    storage.push(
      storedFile(
        'lease-exports/user-b/other-export/hyreskontrakt-2026-11-10.xlsx',
        new Date('2026-11-10T09:31:00.000Z')
      )
    )

    at('2026-11-10T10:00:00.000Z')
    const runningClaim = leaseExportRegistry.claim('user-a', {
      status: 'ended',
    })
    if (!runningClaim.ok) throw new Error('claim failed')

    jest.setSystemTime(NOW)
    const res = await request(app.callback()).get('/lease-exports').set(asUserA)

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(3)
    expect(res.body.content.map((e: { id: string }) => e.id)).toEqual([
      runningClaim.job.id,
      doneClaim.job.id,
      failedClaim.job.id,
    ])
    expect(res.body.content[0]).toEqual({
      id: runningClaim.job.id,
      status: 'running',
      phase: 'fetching-leases',
      statusFilter: ['ended'],
      leaseCount: null,
      startedAt: '2026-11-10T10:00:00.000Z',
      finishedAt: null,
      fileName: null,
      sizeBytes: null,
      expiresAt: null,
      failureReason: null,
    })
    expect(res.body.content[1]).toMatchObject({
      id: doneClaim.job.id,
      status: 'done',
      phase: null,
      statusFilter: ['ended'],
      leaseCount: 42,
      fileName: 'hyreskontrakt-2026-11-10.xlsx',
      sizeBytes: 12345,
      expiresAt: '2026-11-17T09:05:00.000Z',
      failureReason: null,
    })
    expect(res.body.content[2]).toEqual({
      id: failedClaim.job.id,
      status: 'failed',
      phase: null,
      statusFilter: ['current'],
      leaseCount: null,
      startedAt: '2026-11-10T08:00:00.000Z',
      finishedAt: '2026-11-10T08:01:00.000Z',
      fileName: null,
      sizeBytes: null,
      expiresAt: null,
      failureReason: 'export-failed',
    })
  })

  it('deletes stored exports older than 7 days and does not list them', async () => {
    const oldOwnKey =
      'lease-exports/user-a/old-export/hyreskontrakt-2026-11-01.xlsx'
    const oldOtherKey =
      'lease-exports/user-b/old-other/hyreskontrakt-2026-11-02.xlsx'
    const freshKey =
      'lease-exports/user-a/fresh-export/hyreskontrakt-2026-11-11.xlsx'
    storage.push(
      storedFile(oldOwnKey, new Date(NOW.getTime() - 8 * DAY_MS)),
      storedFile(oldOtherKey, new Date(NOW.getTime() - 8 * DAY_MS)),
      storedFile(freshKey, new Date(NOW.getTime() - DAY_MS), 2048)
    )

    const res = await request(app.callback()).get('/lease-exports').set(asUserA)

    expect(res.status).toBe(200)
    expect(fileStorageAdapter.deleteFile).toHaveBeenCalledWith(oldOwnKey)
    expect(fileStorageAdapter.deleteFile).toHaveBeenCalledWith(oldOtherKey)
    expect(fileStorageAdapter.deleteFile).not.toHaveBeenCalledWith(freshKey)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0]).toMatchObject({
      id: 'fresh-export',
      status: 'done',
      fileName: 'hyreskontrakt-2026-11-11.xlsx',
      sizeBytes: 2048,
      expiresAt: new Date(NOW.getTime() + 6 * DAY_MS).toISOString(),
    })
  })

  it('lists an export once while its upload has landed but the job still runs', async () => {
    const claim = leaseExportRegistry.claim('user-a', { status: 'ended' })
    if (!claim.ok) throw new Error('claim failed')
    storage.push(
      storedFile(
        `lease-exports/user-a/${claim.job.id}/hyreskontrakt-2026-11-12.xlsx`,
        NOW
      )
    )

    const res = await request(app.callback()).get('/lease-exports').set(asUserA)

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(1)
    expect(res.body.content[0]).toMatchObject({
      id: claim.job.id,
      status: 'running',
    })
  })

  it('answers 500, not an empty list, when listing stored files fails', async () => {
    jest
      .spyOn(fileStorageAdapter, 'listFiles')
      .mockResolvedValue({ ok: false, err: 'unknown' })

    const res = await request(app.callback()).get('/lease-exports').set(asUserA)

    expect(res.status).toBe(500)
    expect(res.body.content).toBeUndefined()
  })
})

describe('GET /lease-exports/:exportId/url', () => {
  it("signs the caller's own done export for 300 seconds", async () => {
    const key = 'lease-exports/user-a/own-export/hyreskontrakt-2026-11-12.xlsx'
    storage.push(storedFile(key, NOW))

    const res = await request(app.callback())
      .get('/lease-exports/own-export/url')
      .set(asUserA)

    expect(res.status).toBe(200)
    expect(fileStorageAdapter.getFileUrl).toHaveBeenCalledWith(key, 300)
    expect(res.body.content).toEqual({
      url: 'https://files.example.test/signed',
      expiresAt: new Date(NOW.getTime() + 300 * 1000).toISOString(),
    })
  })

  it("answers 404 for another user's export", async () => {
    storage.push(
      storedFile(
        'lease-exports/user-b/their-export/hyreskontrakt-2026-11-12.xlsx',
        NOW
      )
    )

    const res = await request(app.callback())
      .get('/lease-exports/their-export/url')
      .set(asUserA)

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('lease-export-not-found')
    expect(fileStorageAdapter.getFileUrl).not.toHaveBeenCalled()
  })

  it('answers 404 for an export that is still running', async () => {
    const claim = leaseExportRegistry.claim('user-a', { status: 'ended' })
    if (!claim.ok) throw new Error('claim failed')

    const res = await request(app.callback())
      .get(`/lease-exports/${claim.job.id}/url`)
      .set(asUserA)

    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('lease-export-not-found')
    expect(fileStorageAdapter.getFileUrl).not.toHaveBeenCalled()
  })
})
