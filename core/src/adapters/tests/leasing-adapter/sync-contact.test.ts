import nock from 'nock'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'

const contactCode = 'P12345'

describe('leasing-adapter.syncContactToLeasing', () => {
  it('returns ok on successful sync (200)', async () => {
    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${contactCode}/sync`)
      .reply(200, { content: { _id: 'tenant-1' } })

    const result = await leasingAdapter.syncContactToLeasing(contactCode)

    expect(result).toEqual({ ok: true, data: { skipped: false } })
  })

  it('returns ok on successful sync (201)', async () => {
    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${contactCode}/sync`)
      .reply(201, { content: { _id: 'tenant-1' } })

    const result = await leasingAdapter.syncContactToLeasing(contactCode)

    expect(result).toEqual({ ok: true, data: { skipped: false } })
  })

  it('returns data.skipped=true when downstream reports skipped', async () => {
    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${contactCode}/sync`)
      .reply(200, { content: undefined, skipped: true })

    const result = await leasingAdapter.syncContactToLeasing(contactCode)

    expect(result).toEqual({ ok: true, data: { skipped: true } })
  })

  it('returns sync-failed on non-success HTTP response (4xx)', async () => {
    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${contactCode}/sync`)
      .reply(400, { error: 'Bad request' })

    const result = await leasingAdapter.syncContactToLeasing(contactCode)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('sync-failed')
      expect(result.statusCode).toBe(400)
    }
  })

  it('returns sync-failed on 5xx', async () => {
    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${contactCode}/sync`)
      .reply(500, { error: 'Internal server error' })

    const result = await leasingAdapter.syncContactToLeasing(contactCode)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('sync-failed')
      expect(result.statusCode).toBe(500)
    }
  })

  it('returns unknown on network error', async () => {
    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${contactCode}/sync`)
      .replyWithError('Connection refused')

    const result = await leasingAdapter.syncContactToLeasing(contactCode)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })
})
