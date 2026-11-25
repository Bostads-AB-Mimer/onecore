import assert from 'node:assert'
import nock from 'nock'
import { loggedAxios } from '@onecore/utilities'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'
import * as factory from '../../../../test/factories'

describe(leasingAdapter.getUpdatedLeases, () => {
  it('parses timestamp string to Date on 200 response', async () => {
    const since = new Date('2026-04-28T10:00:00.000Z')
    const change = factory.leaseChange.build()
    const wireContent = [
      { ...change, timestamp: change.timestamp.toISOString() },
    ]

    nock(config.tenantsLeasesService.url)
      .get('/leases/sync')
      .query({ since: '2026-04-28T10:00:00.000Z' })
      .reply(200, { content: wireContent })

    const result = await leasingAdapter.getUpdatedLeases(since)

    expect(result).toEqual({ ok: true, data: [change] })
  })

  it('returns lease changes when since is null', async () => {
    const change = factory.leaseChange.build()
    const wireContent = [
      { ...change, timestamp: change.timestamp.toISOString() },
    ]

    nock(config.tenantsLeasesService.url)
      .get('/leases/sync')
      .reply(200, { content: wireContent })

    const result = await leasingAdapter.getUpdatedLeases(null)

    assert(result.ok)
    expect(result.data[0].timestamp).toEqual(change.timestamp)
  })

  it('returns { ok: false, err: "unknown" } on non-200 response', async () => {
    const since = new Date('2026-04-28T10:00:00.000Z')

    nock(config.tenantsLeasesService.url)
      .get('/leases/sync')
      .query({ since: '2026-04-28T10:00:00.000Z' })
      .reply(400, { error: 'Bad request' })

    const result = await leasingAdapter.getUpdatedLeases(since)

    assert(!result.ok)
    expect(result.err).toBe('unknown')
  })

  it('returns { ok: false, err: "unknown" } on network error', async () => {
    const since = new Date('2026-04-28T10:00:00.000Z')

    nock(config.tenantsLeasesService.url)
      .get('/leases/sync')
      .query({ since: '2026-04-28T10:00:00.000Z' })
      .replyWithError('Connection refused')

    const result = await leasingAdapter.getUpdatedLeases(since)

    assert(!result.ok)
    expect(result.err).toBe('unknown')
  })
})

describe(leasingAdapter.syncLease, () => {
  const contactCode = 'P12345'
  const leaseId = '101-002-03-0201/07'

  it('returns { ok: true, data: { action, leaseId } } on success', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', { leaseId, contactCode, action: 'create' })
      .reply(200, { content: { action: 'created', leaseId } })

    const result = await leasingAdapter.syncLease(
      leaseId,
      contactCode,
      'create'
    )

    expect(result).toEqual({
      ok: true,
      data: { action: 'created', leaseId },
    })
  })

  it('returns { ok: true, data: { action, leaseId } } on 201 response', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', { leaseId, contactCode, action: 'create' })
      .reply(201, { content: { action: 'created', leaseId } })

    const result = await leasingAdapter.syncLease(
      leaseId,
      contactCode,
      'create'
    )

    expect(result).toEqual({
      ok: true,
      data: { action: 'created', leaseId },
    })
  })

  it('returns { ok: false, err: "sync-failed" } on non-200 response', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', { leaseId, contactCode, action: 'terminate' })
      .reply(400, { error: 'Bad request' })

    const result = await leasingAdapter.syncLease(
      leaseId,
      contactCode,
      'terminate'
    )

    assert(!result.ok)
    expect(result.err).toBe('sync-failed')
  })

  it('returns { ok: false, err: "unknown" } on network error', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', { leaseId, contactCode, action: 'terminate' })
      .replyWithError('Connection refused')

    const result = await leasingAdapter.syncLease(
      leaseId,
      contactCode,
      'terminate'
    )

    assert(!result.ok)
    expect(result.err).toBe('unknown')
  })

  it('passes the document outcome through', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/leases/sync')
      .reply(201, {
        content: { action: 'created', leaseId, document: 'missing' },
      })

    const result = await leasingAdapter.syncLease(
      leaseId,
      contactCode,
      'create'
    )

    expect(result).toEqual({
      ok: true,
      data: { action: 'created', leaseId, document: 'missing' },
    })
  })

  it('carries the service error as detail on a failed sync', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/leases/sync')
      .reply(500, { error: 'termination-pdf-upload-failed' })

    const result = await leasingAdapter.syncLease(
      leaseId,
      undefined,
      'terminate'
    )

    assert(!result.ok)
    expect(result.err).toBe('sync-failed')
    expect(result.detail).toBe('termination-pdf-upload-failed')
  })

  it('appends the service detail to the error', async () => {
    nock(config.tenantsLeasesService.url).post('/leases/sync').reply(409, {
      error: 'end-date-mismatch',
      detail: 'Tenfast 2026-05-31, Xpand 2026-04-30',
    })

    const result = await leasingAdapter.syncLease(
      leaseId,
      undefined,
      'terminate'
    )

    assert(!result.ok)
    expect(result.statusCode).toBe(409)
    expect(result.detail).toBe(
      'end-date-mismatch: Tenfast 2026-05-31, Xpand 2026-04-30'
    )
  })

  it('serializes body without contactCode when undefined', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', { leaseId, action: 'terminate' })
      .reply(200, { content: { action: 'terminated', leaseId } })

    const result = await leasingAdapter.syncLease(
      leaseId,
      undefined,
      'terminate'
    )

    expect(result).toEqual({
      ok: true,
      data: { action: 'terminated', leaseId },
    })
  })
})

// Must stay under the CronJob's activeDeadlineSeconds (300s) and above
// Leasing's worst case: six Tenfast calls at 10s plus one 60s upload.
const FEW_MINUTES_MS = 3 * 60_000
const LEASING_WORK_BOUND_MS = 6 * 10_000 + 60_000

describe('lease sync call timeouts', () => {
  afterEach(() => jest.restoreAllMocks())

  it('bounds getUpdatedLeases', async () => {
    const getSpy = jest
      .spyOn(loggedAxios, 'get')
      .mockResolvedValue({ status: 200, data: { content: [] } })

    await leasingAdapter.getUpdatedLeases(null)

    const timeout = getSpy.mock.calls[0][1]?.timeout
    expect(timeout).toBeGreaterThan(0)
    expect(timeout).toBeLessThanOrEqual(FEW_MINUTES_MS)
  })

  it('bounds syncLease without cutting Leasing off mid-sync', async () => {
    const postSpy = jest.spyOn(loggedAxios, 'post').mockResolvedValue({
      status: 200,
      data: { content: { action: 'created', leaseId: '1' } },
    })

    await leasingAdapter.syncLease('1', 'P1', 'create')

    const timeout = postSpy.mock.calls[0][2]?.timeout
    expect(timeout).toBeGreaterThanOrEqual(LEASING_WORK_BOUND_MS)
    expect(timeout).toBeLessThanOrEqual(FEW_MINUTES_MS)
  })
})
