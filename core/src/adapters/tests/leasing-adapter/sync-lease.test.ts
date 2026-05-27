import assert from 'node:assert'
import nock from 'nock'

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
  it('returns { ok: true, data: { action, leaseId } } on success', async () => {
    const contact = factory.syncContactToLeasingPayload.build()
    const leaseId = '101-002-03-0201/07'
    // Normalize contact so nock body-match sees the same JSON axios will send
    const serialized = JSON.parse(
      JSON.stringify({ leaseId, contact, action: 'create' })
    )

    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', serialized)
      .reply(200, { content: { action: 'created', leaseId } })

    const result = await leasingAdapter.syncLease(leaseId, contact, 'create')

    expect(result).toEqual({
      ok: true,
      data: { action: 'created', leaseId },
    })
  })

  it('returns { ok: true, data: { action, leaseId } } on 201 response', async () => {
    const contact = factory.syncContactToLeasingPayload.build()
    const leaseId = '101-002-03-0201/07'
    const serialized = JSON.parse(
      JSON.stringify({ leaseId, contact, action: 'create' })
    )

    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', serialized)
      .reply(201, { content: { action: 'created', leaseId } })

    const result = await leasingAdapter.syncLease(leaseId, contact, 'create')

    expect(result).toEqual({
      ok: true,
      data: { action: 'created', leaseId },
    })
  })

  it('returns { ok: false, err: "sync-failed" } on non-200 response', async () => {
    const contact = factory.syncContactToLeasingPayload.build()
    const leaseId = '101-002-03-0201/07'
    const serialized = JSON.parse(
      JSON.stringify({ leaseId, contact, action: 'terminate' })
    )

    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', serialized)
      .reply(400, { error: 'Bad request' })

    const result = await leasingAdapter.syncLease(leaseId, contact, 'terminate')

    assert(!result.ok)
    expect(result.err).toBe('sync-failed')
  })

  it('returns { ok: false, err: "unknown" } on network error', async () => {
    const contact = factory.syncContactToLeasingPayload.build()
    const leaseId = '101-002-03-0201/07'
    const serialized = JSON.parse(
      JSON.stringify({ leaseId, contact, action: 'terminate' })
    )

    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', serialized)
      .replyWithError('Connection refused')

    const result = await leasingAdapter.syncLease(leaseId, contact, 'terminate')

    assert(!result.ok)
    expect(result.err).toBe('unknown')
  })

  it('serializes body without contact when contact is undefined', async () => {
    const leaseId = '101-002-03-0201/07'
    const serialized = JSON.parse(
      JSON.stringify({ leaseId, action: 'terminate' })
    )

    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', serialized)
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
