import nock from 'nock'

import config from '../../../common/config'
import * as economyAdapter from '../../economy-adapter'

afterEach(nock.cleanAll)

describe('economy-adapter.getLatestPaymentCursor', () => {
  it('returns ok with cursor on 200', async () => {
    nock(config.economyService.url)
      .get('/payments/latest-cursor')
      .reply(200, { content: 'cursor-123' })

    const result = await economyAdapter.getLatestPaymentCursor()

    expect(result).toEqual({ ok: true, data: 'cursor-123' })
  })

  it('returns ok with null when no transactions exist', async () => {
    nock(config.economyService.url)
      .get('/payments/latest-cursor')
      .reply(200, { content: null })

    const result = await economyAdapter.getLatestPaymentCursor()

    expect(result).toEqual({ ok: true, data: null })
  })

  it('returns ok: false with err unknown on non-200 status', async () => {
    nock(config.economyService.url)
      .get('/payments/latest-cursor')
      .reply(500, { message: 'Internal Server Error' })

    const result = await economyAdapter.getLatestPaymentCursor()

    expect(result).toMatchObject({ ok: false, err: 'unknown', statusCode: 500 })
  })

  it('returns ok: false with err unknown on network failure', async () => {
    nock(config.economyService.url)
      .get('/payments/latest-cursor')
      .replyWithError('Connection refused')

    const result = await economyAdapter.getLatestPaymentCursor()

    expect(result).toMatchObject({ ok: false, err: 'unknown' })
  })
})
