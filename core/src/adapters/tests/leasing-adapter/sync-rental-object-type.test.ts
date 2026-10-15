import assert from 'node:assert'
import nock from 'nock'

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
        content: [
          {
            rentalObjectCode: '807-033-01-0101',
            code: 'POÄNGFRITT',
            label: 'Poängfritt',
            timestamp: '2026-10-15T08:08:28.000Z',
          },
        ],
      })

    const result = await leasingAdapter.getRentalObjectTypeChanges(
      new Date('2026-10-15T00:00:00.000Z')
    )

    expect(result).toEqual({
      ok: true,
      data: [
        {
          rentalObjectCode: '807-033-01-0101',
          code: 'POÄNGFRITT',
          label: 'Poängfritt',
          timestamp: new Date('2026-10-15T08:08:28.000Z'),
        },
      ],
    })
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
      .reply(200, { content: { action: 'skipped' } })

    const result = await leasingAdapter.syncRentalObjectType('807 033', 'STD')

    expect(result).toEqual({ ok: true, data: { action: 'skipped' } })
  })
})
