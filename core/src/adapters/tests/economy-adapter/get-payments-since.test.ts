import nock from 'nock'

import config from '../../../common/config'
import * as economyAdapter from '../../economy-adapter'
import { schemas } from '@onecore/types'

afterEach(nock.cleanAll)

const makePaymentEvent = (
  overrides?: Partial<{
    type: string
    invoiceId: string
    matchId: number
    amount: number
    paymentDate: string
    text: string | null
    transactionSourceCode: string
  }>
) => ({
  type: 'SO',
  invoiceId: '55123456',
  matchId: 42,
  amount: 1000,
  paymentDate: '2026-04-01T00:00:00.000Z',
  text: 'Hyra',
  transactionSourceCode: 'SO',
  ...overrides,
})

describe('economy-adapter.getPaymentsSince', () => {
  it('returns ok with parsed payment events on 200', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .reply(200, { content: [makePaymentEvent()] })

    const result = await economyAdapter.getPaymentsSince(new Date('2026-04-01'))

    expect(result).toEqual({
      ok: true,
      data: [expect.objectContaining({ invoiceId: '55123456' })],
    })
  })

  it('coerces paymentDate ISO string to a Date instance', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .reply(200, {
        content: [
          makePaymentEvent({ paymentDate: '2026-04-01T00:00:00.000Z' }),
        ],
      })

    const result = await economyAdapter.getPaymentsSince(new Date('2026-04-01'))

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          paymentDate: new Date('2026-04-01T00:00:00.000Z'),
        }),
      ],
    })
  })

  it('satisfies InvoicePaymentEventSchema on 200', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .reply(200, { content: [makePaymentEvent()] })

    const result = await economyAdapter.getPaymentsSince(new Date('2026-04-01'))

    expect(result).toMatchObject({ ok: true })
    expect(() =>
      schemas.v1.InvoicePaymentEventSchema.array().parse(
        result.ok ? result.data : null
      )
    ).not.toThrow()
  })

  it('returns ok: false with err unknown on non-200 status', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .reply(500, { message: 'Internal Server Error' })

    const result = await economyAdapter.getPaymentsSince(new Date('2026-04-01'))

    expect(result).toMatchObject({ ok: false, err: 'unknown', statusCode: 500 })
  })

  it('returns ok: false with err unknown on network failure', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .replyWithError('Connection refused')

    const result = await economyAdapter.getPaymentsSince(new Date('2026-04-01'))

    expect(result).toMatchObject({ ok: false, err: 'unknown' })
  })
})
