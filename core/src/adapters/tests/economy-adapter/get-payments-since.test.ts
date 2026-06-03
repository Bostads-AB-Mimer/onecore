import assert from 'node:assert'
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
    slTransactionType: string | null
  }>
) => ({
  type: 'OCR',
  invoiceId: '55123456',
  matchId: 42,
  amount: 1000,
  paymentDate: '2026-04-01T00:00:00.000Z',
  text: 'Hyra',
  transactionSourceCode: 'OCR',
  slTransactionType: null,
  ...overrides,
})

const makeResult = (
  overrides?: Partial<{ lastCursor: string | null; events: object[] }>
) => ({
  events: [makePaymentEvent()],
  lastCursor: 'cursor-abc',
  ...overrides,
})

describe('economy-adapter.getPaymentsSince', () => {
  it('returns ok with parsed result on 200', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .reply(200, { content: makeResult() })

    const result = await economyAdapter.getPaymentsSince('cursor-abc')

    expect(result).toEqual({
      ok: true,
      data: {
        lastCursor: 'cursor-abc',
        events: [expect.objectContaining({ invoiceId: '55123456' })],
      },
    })
  })

  it('coerces paymentDate ISO string to a Date instance', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .reply(200, {
        content: makeResult({
          events: [
            makePaymentEvent({ paymentDate: '2026-04-01T00:00:00.000Z' }),
          ],
        }),
      })

    const result = await economyAdapter.getPaymentsSince('cursor-abc')

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        events: [
          expect.objectContaining({
            paymentDate: new Date('2026-04-01T00:00:00.000Z'),
          }),
        ],
      }),
    })
  })

  it('satisfies InvoicePaymentEventSchema for each event', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .reply(200, { content: makeResult() })

    const result = await economyAdapter.getPaymentsSince('cursor-abc')

    assert(result.ok)
    expect(() =>
      schemas.v1.InvoicePaymentEventSchema.array().parse(result.data.events)
    ).not.toThrow()
  })

  it('passes the cursor as the after query param', async () => {
    let capturedQuery: any

    nock(config.economyService.url)
      .get('/payments/since')
      .query((q) => {
        capturedQuery = q
        return true
      })
      .reply(200, { content: makeResult({ lastCursor: 'cursor-xyz' }) })

    await economyAdapter.getPaymentsSince('cursor-abc')

    expect(capturedQuery.after).toBe('cursor-abc')
  })

  it('always sends the cursor as the after query param', async () => {
    let capturedQuery: any

    nock(config.economyService.url)
      .get('/payments/since')
      .query((q) => {
        capturedQuery = q
        return true
      })
      .reply(200, { content: makeResult({ lastCursor: null }) })

    await economyAdapter.getPaymentsSince('cursor-seed')

    expect(capturedQuery.after).toBe('cursor-seed')
  })

  it('returns ok: false with err unknown on non-200 status', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .reply(500, { message: 'Internal Server Error' })

    const result = await economyAdapter.getPaymentsSince('cursor-abc')

    expect(result).toMatchObject({ ok: false, err: 'unknown', statusCode: 500 })
  })

  it('returns ok: false with err unknown on network failure', async () => {
    nock(config.economyService.url)
      .get('/payments/since')
      .query(true)
      .replyWithError('Connection refused')

    const result = await economyAdapter.getPaymentsSince('cursor-abc')

    expect(result).toMatchObject({ ok: false, err: 'unknown' })
  })
})
