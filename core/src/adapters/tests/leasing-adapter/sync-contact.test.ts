import nock from 'nock'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'
import * as factory from '../../../../test/factories'

describe('leasing-adapter.syncContactToLeasing', () => {
  it('returns ok on successful sync (200)', async () => {
    const payload = factory.syncContactToLeasingPayload.build()

    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${payload.contactCode}/sync`)
      .reply(200, { content: { _id: 'tenant-1' } })

    const result = await leasingAdapter.syncContactToLeasing(payload)

    expect(result).toEqual({ ok: true, data: { skipped: false } })
  })

  it('returns ok on successful sync (201)', async () => {
    const payload = factory.syncContactToLeasingPayload.build()

    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${payload.contactCode}/sync`)
      .reply(201, { content: { _id: 'tenant-1' } })

    const result = await leasingAdapter.syncContactToLeasing(payload)

    expect(result).toEqual({ ok: true, data: { skipped: false } })
  })

  it('returns data.skipped=true when downstream reports skipped', async () => {
    const payload = factory.syncContactToLeasingPayload.build()

    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${payload.contactCode}/sync`)
      .reply(200, { content: undefined, skipped: true })

    const result = await leasingAdapter.syncContactToLeasing(payload)

    expect(result).toEqual({ ok: true, data: { skipped: true } })
  })

  it('returns sync-failed on non-success HTTP response (4xx)', async () => {
    const payload = factory.syncContactToLeasingPayload.build()

    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${payload.contactCode}/sync`)
      .reply(400, { error: 'Bad request' })

    const result = await leasingAdapter.syncContactToLeasing(payload)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('sync-failed')
      expect(result.statusCode).toBe(400)
    }
  })

  it('returns sync-failed on 5xx', async () => {
    const payload = factory.syncContactToLeasingPayload.build()

    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${payload.contactCode}/sync`)
      .reply(500, { error: 'Internal server error' })

    const result = await leasingAdapter.syncContactToLeasing(payload)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('sync-failed')
      expect(result.statusCode).toBe(500)
    }
  })

  it('returns unknown on network error', async () => {
    const payload = factory.syncContactToLeasingPayload.build()

    nock(config.tenantsLeasesService.url)
      .post(`/contacts/${payload.contactCode}/sync`)
      .replyWithError('Connection refused')

    const result = await leasingAdapter.syncContactToLeasing(payload)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })
})
