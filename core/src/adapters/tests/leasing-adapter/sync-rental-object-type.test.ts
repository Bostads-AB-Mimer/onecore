import assert from 'node:assert'
import nock from 'nock'
import { loggedAxios } from '@onecore/utilities'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'

afterEach(() => {
  nock.cleanAll()
})

describe('getRentalObjectTypeChanges', () => {
  it('parses timestamp strings to Dates on 200', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/rental-objects/types/sync')
      .query({ since: '2026-10-15T00:00:00.000Z' })
      .reply(200, {
        content: {
          changes: [
            {
              rentalObjectCode: '807-033-01-0101',
              code: 'POÄNGFRITT',
              label: 'Poängfritt',
              timestamp: '2026-10-15T08:08:28.000Z',
            },
          ],
          until: '2026-10-15T08:09:00.000Z',
        },
      })

    const result = await leasingAdapter.getRentalObjectTypeChanges(
      new Date('2026-10-15T00:00:00.000Z')
    )

    expect(result).toEqual({
      ok: true,
      data: {
        changes: [
          {
            rentalObjectCode: '807-033-01-0101',
            code: 'POÄNGFRITT',
            label: 'Poängfritt',
            timestamp: new Date('2026-10-15T08:08:28.000Z'),
          },
        ],
        until: new Date('2026-10-15T08:09:00.000Z'),
      },
    })
  })

  it('sends no since parameter when since is null', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/rental-objects/types/sync')
      .query({})
      .reply(200, { content: { changes: [], until: null } })

    const result = await leasingAdapter.getRentalObjectTypeChanges(null)

    expect(result).toEqual({ ok: true, data: { changes: [], until: null } })
  })

  it('returns unknown when the response does not match the schema', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/rental-objects/types/sync')
      .query(true)
      .reply(200, {
        content: {
          changes: [{ rentalObjectCode: 1, timestamp: 'not-a-date' }],
          until: null,
        },
      })

    const result = await leasingAdapter.getRentalObjectTypeChanges(
      new Date('2026-10-15T00:00:00.000Z')
    )

    assert(!result.ok)
    expect(result.err).toBe('unknown')
  })

  it('returns unknown on a 400', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/rental-objects/types/sync')
      .query(true)
      .reply(400, { error: 'bad since' })

    const result = await leasingAdapter.getRentalObjectTypeChanges(
      new Date('2026-10-15T00:00:00.000Z')
    )

    assert(!result.ok)
    expect(result.err).toBe('unknown')
  })

  it('returns unknown on a 500', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/rental-objects/types/sync')
      .query(true)
      .reply(500, { error: 'db down' })

    const result = await leasingAdapter.getRentalObjectTypeChanges(
      new Date('2026-10-15T00:00:00.000Z')
    )

    assert(!result.ok)
    expect(result.err).toBe('unknown')
  })
})

describe('syncRentalObjectType', () => {
  it('returns the action on 200', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync', { code: 'STD' })
      .reply(200, {
        content: { action: 'updated', rentalObjectCode: '807-033-01-0101' },
      })

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      'STD'
    )

    expect(result).toEqual({ ok: true, data: { action: 'updated' } })
  })

  it('sends a null code as null', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync', { code: null })
      .reply(422, { error: 'unknown-rental-object-type' })

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      null
    )

    assert(!result.ok)
    expect(result.err).toBe('unknown-type')
  })

  it('maps 422 to unknown-type', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync')
      .reply(422, { error: 'unknown-rental-object-type' })

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      'HDK'
    )

    expect(result).toEqual({ ok: false, err: 'unknown-type', statusCode: 422 })
  })

  it('maps a 422 with another error to sync-failed', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync')
      .reply(422, { error: 'something-else' })

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      'STD'
    )

    expect(result).toEqual({ ok: false, err: 'sync-failed', statusCode: 422 })
  })

  it('maps a 200 with an unknown action to sync-failed', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync')
      .reply(200, {
        content: { action: 'deleted', rentalObjectCode: '807-033-01-0101' },
      })

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      'STD'
    )

    expect(result).toEqual({ ok: false, err: 'sync-failed', statusCode: 200 })
  })

  it('maps 422 rental-object-rejected to rejected', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync')
      .reply(422, { error: 'rental-object-rejected' })

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      'STD'
    )

    expect(result).toEqual({ ok: false, err: 'rejected', statusCode: 422 })
  })

  it('maps 502 to sync-failed and keeps the status', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync')
      .reply(502, 'Bad Gateway')

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      'STD'
    )

    expect(result).toEqual({ ok: false, err: 'sync-failed', statusCode: 502 })
  })

  it('maps 500 to sync-failed and keeps the status', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync')
      .reply(500, { error: 'update-failed' })

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      'STD'
    )

    expect(result).toEqual({ ok: false, err: 'sync-failed', statusCode: 500 })
  })

  it('maps a network error to sync-failed', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807-033-01-0101/type/sync')
      .replyWithError('ECONNREFUSED')

    const result = await leasingAdapter.syncRentalObjectType(
      '807-033-01-0101',
      'STD'
    )

    assert(!result.ok)
    expect(result.err).toBe('sync-failed')
  })

  it('URL-encodes the rental object code', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/rental-objects/807%20033/type/sync')
      .reply(200, {
        content: { action: 'skipped', rentalObjectCode: '807 033' },
      })

    const result = await leasingAdapter.syncRentalObjectType('807 033', 'STD')

    expect(result).toEqual({ ok: true, data: { action: 'skipped' } })
  })
})

// A hung call must fail within a few minutes so the next scheduled run can
// start, but core may not give up while Leasing is still working: a type
// sync is a couple of Tenfast calls in sequence, each bounded at 30s there.
const FEW_MINUTES_MS = 5 * 60_000
const LEASING_WORK_BOUND_MS = 2 * 30_000

describe('rental object type sync call timeouts', () => {
  afterEach(() => jest.restoreAllMocks())

  it('bounds getRentalObjectTypeChanges', async () => {
    const getSpy = jest.spyOn(loggedAxios, 'get').mockResolvedValue({
      status: 200,
      data: { content: { changes: [], until: null } },
    })

    await leasingAdapter.getRentalObjectTypeChanges(null)

    const timeout = getSpy.mock.calls[0][1]?.timeout
    expect(timeout).toBeGreaterThan(0)
    expect(timeout).toBeLessThanOrEqual(FEW_MINUTES_MS)
  })

  it('bounds syncRentalObjectType without cutting Leasing off mid-sync', async () => {
    const postSpy = jest.spyOn(loggedAxios, 'post').mockResolvedValue({
      status: 200,
      data: { content: { action: 'updated', rentalObjectCode: '1' } },
    })

    await leasingAdapter.syncRentalObjectType('1', 'STD')

    const timeout = postSpy.mock.calls[0][2]?.timeout
    expect(timeout).toBeGreaterThanOrEqual(LEASING_WORK_BOUND_MS)
    expect(timeout).toBeLessThanOrEqual(FEW_MINUTES_MS)
  })
})
