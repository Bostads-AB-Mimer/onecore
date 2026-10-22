import nock from 'nock'

import config from '../../../common/config'
import * as economyAdapter from '../../economy-adapter'
import * as factory from '../../../../test/factories'

describe('economy-adapter.syncContactToEconomy', () => {
  it('returns ok on successful sync', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    nock(config.economyService.url)
      .post(`/customers/${payload.contactCode}/sync`)
      .reply(200, { content: { dbId: '12345' } })

    const { contactCode, ...contactData } = payload
    const result = await economyAdapter.syncContactToEconomy(
      contactCode,
      contactData
    )

    expect(result).toEqual({ ok: true, data: { skipped: false } })
  })

  it('returns data.skipped=true when downstream reports skipped', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    nock(config.economyService.url)
      .post(`/customers/${payload.contactCode}/sync`)
      .reply(200, { content: null, skipped: true })

    const { contactCode, ...contactData } = payload
    const result = await economyAdapter.syncContactToEconomy(
      contactCode,
      contactData
    )

    expect(result).toEqual({ ok: true, data: { skipped: true } })
  })

  it('returns sync-failed on non-success status', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    nock(config.economyService.url)
      .post(`/customers/${payload.contactCode}/sync`)
      .reply(400, { error: 'Bad request' })

    const { contactCode, ...contactData } = payload
    const result = await economyAdapter.syncContactToEconomy(
      contactCode,
      contactData
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('sync-failed')
      expect(result.statusCode).toBe(400)
    }
  })

  it.each([400, 404])(
    'returns sync-failed on %i when 4xx resolves process-wide',
    async (status) => {
      // Sets axios.defaults.validateStatus to accept < 500 on the shared instance
      await import('../../leasing-adapter')
      const payload = factory.syncContactToEconomyPayload.build()

      nock(config.economyService.url)
        .post(`/customers/${payload.contactCode}/sync`)
        .query({ create: 'true' })
        .reply(status, { error: 'Invalid request body' })

      const { contactCode, ...contactData } = payload
      const result = await economyAdapter.syncContactToEconomy(
        contactCode,
        contactData,
        { create: true }
      )

      expect(result).toEqual({
        ok: false,
        err: 'sync-failed',
        statusCode: status,
      })
    }
  )

  it('returns unknown on network error', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    nock(config.economyService.url)
      .post(`/customers/${payload.contactCode}/sync`)
      .replyWithError('Connection refused')

    const { contactCode, ...contactData } = payload
    const result = await economyAdapter.syncContactToEconomy(
      contactCode,
      contactData
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })
})
