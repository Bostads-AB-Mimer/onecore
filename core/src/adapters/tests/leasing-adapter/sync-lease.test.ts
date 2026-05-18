import nock from 'nock'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'
import * as factory from '../../../../test/factories'

describe('leasing-adapter.getUpdatedLeases', () => {
  it('returns lease changes on 200 response', async () => {
    const since = new Date('2026-04-28T10:00:00.000Z')
    const leaseChanges = [
      {
        leaseId: '101-002-03-0201/07',
        contactCode: 'P174965',
        rentalObjectId: '101-002-03-0201',
        action: 'create',
      },
    ]

    nock(config.tenantsLeasesService.url)
      .get('/leases/sync')
      .query({ since: '2026-04-28T10:00:00.000Z' })
      .reply(200, { content: leaseChanges })

    const result = await leasingAdapter.getUpdatedLeases(since)

    expect(result).toEqual({ ok: true, data: leaseChanges })
  })

  it('returns lease changes when since is null', async () => {
    const leaseChanges = [
      {
        leaseId: '101-002-03-0201/07',
        contactCode: 'P174965',
        rentalObjectId: '101-002-03-0201',
        action: 'create',
      },
    ]

    nock(config.tenantsLeasesService.url)
      .get('/leases/sync')
      .reply(200, { content: leaseChanges })

    const result = await leasingAdapter.getUpdatedLeases(null)

    expect(result).toEqual({ ok: true, data: leaseChanges })
  })

  it('returns { ok: false, err: "unknown" } on non-200 response', async () => {
    const since = new Date('2026-04-28T10:00:00.000Z')

    nock(config.tenantsLeasesService.url)
      .get('/leases/sync')
      .query({ since: '2026-04-28T10:00:00.000Z' })
      .reply(400, { error: 'Bad request' })

    const result = await leasingAdapter.getUpdatedLeases(since)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })

  it('returns { ok: false, err: "unknown" } on network error', async () => {
    const since = new Date('2026-04-28T10:00:00.000Z')

    nock(config.tenantsLeasesService.url)
      .get('/leases/sync')
      .query({ since: '2026-04-28T10:00:00.000Z' })
      .replyWithError('Connection refused')

    const result = await leasingAdapter.getUpdatedLeases(since)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })
})

describe('leasing-adapter.syncLease', () => {
  it('returns { ok: true, data: { action, leaseId } } on success', async () => {
    const contact = factory.contact.build()
    const leaseId = '101-002-03-0201/07'
    // Normalize contact so nock body-match sees the same JSON axios will send
    const serialized = JSON.parse(JSON.stringify({ leaseId, contact, action: 'create' }))

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
    const contact = factory.contact.build()
    const leaseId = '101-002-03-0201/07'
    const serialized = JSON.parse(JSON.stringify({ leaseId, contact, action: 'create' }))

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
    const contact = factory.contact.build()
    const leaseId = '101-002-03-0201/07'
    const serialized = JSON.parse(JSON.stringify({ leaseId, contact, action: 'terminate' }))

    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', serialized)
      .reply(400, { error: 'Bad request' })

    const result = await leasingAdapter.syncLease(leaseId, contact, 'terminate')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('sync-failed')
    }
  })

  it('returns { ok: false, err: "unknown" } on network error', async () => {
    const contact = factory.contact.build()
    const leaseId = '101-002-03-0201/07'
    const serialized = JSON.parse(JSON.stringify({ leaseId, contact, action: 'terminate' }))

    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', serialized)
      .replyWithError('Connection refused')

    const result = await leasingAdapter.syncLease(leaseId, contact, 'terminate')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })

  it('serializes body without contact when contact is undefined', async () => {
    const leaseId = '101-002-03-0201/07'
    const serialized = JSON.parse(
      JSON.stringify({ leaseId, action: 'terminate' })
    )

    nock(config.tenantsLeasesService.url)
      .post('/leases/sync', serialized)
      .reply(200, { content: { action: 'terminated', leaseId } })

    const result = await leasingAdapter.syncLease(leaseId, undefined, 'terminate')

    expect(result).toEqual({
      ok: true,
      data: { action: 'terminated', leaseId },
    })
  })
})
