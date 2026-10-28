import nock from 'nock'
import { logger } from '@onecore/utilities'

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

  it('passes the undo object through', async () => {
    const payload = factory.syncContactToEconomyPayload.build()
    const undo = {
      previous: {
        fullName: 'Gammal, Namn',
        street: 'Gamla gatan 1',
        zipCode: '22222',
        city: 'Västerås',
        emailAddress: null,
      },
    }
    nock(config.economyService.url)
      .post(`/customers/${payload.contactCode}/sync`)
      .reply(200, { content: '1', skipped: false, undo })

    const { contactCode, ...contactData } = payload
    const result = await economyAdapter.syncContactToEconomy(
      contactCode,
      contactData
    )

    expect(result).toEqual({ ok: true, data: { skipped: false, undo } })
  })

  it('logs no contact values on failure', async () => {
    const payload = factory.syncContactToEconomyPayload.build()
    nock(config.economyService.url)
      .post(`/customers/${payload.contactCode}/sync`)
      .reply(500, { error: 'boom' })
    const errorSpy = jest.spyOn(logger, 'error')

    const { contactCode, ...contactData } = payload
    await economyAdapter.syncContactToEconomy(contactCode, contactData)

    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(payload.fullName)
    errorSpy.mockRestore()
  })
})
