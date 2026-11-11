import nock from 'nock'

import config from '../../../common/config'
import * as economyAdapter from '../../economy-adapter'

afterEach(nock.cleanAll)

describe('economy-adapter.recordInvoicePayment', () => {
  const invoiceId = '55123456'
  const payment = {
    amount: 1000,
    dateTime: new Date('2026-04-02T10:00:00Z'),
    method: 'bank',
  }

  it('returns ok on 200', async () => {
    nock(config.economyService.url)
      .post(`/invoices/${invoiceId}/payments`)
      .reply(200, { content: null })

    const result = await economyAdapter.recordInvoicePayment(invoiceId, payment)

    expect(result).toEqual({ ok: true, data: null })
  })

  it('returns not-found on 404', async () => {
    nock(config.economyService.url)
      .post(`/invoices/${invoiceId}/payments`)
      .reply(404, {})

    const result = await economyAdapter.recordInvoicePayment(invoiceId, payment)

    expect(result).toMatchObject({
      ok: false,
      err: 'not-found',
      statusCode: 404,
    })
  })

  it('returns payment-rejected with the reason on 409', async () => {
    nock(config.economyService.url)
      .post(`/invoices/${invoiceId}/payments`)
      .reply(409, { error: 'payment-rejected', reason: 'Invoice is voided' })

    const result = await economyAdapter.recordInvoicePayment(invoiceId, payment)

    expect(result).toEqual({
      ok: false,
      err: 'payment-rejected',
      statusCode: 409,
      detail: 'Invoice is voided',
    })
  })

  it('returns unknown on a 409 without a payment-rejected body', async () => {
    nock(config.economyService.url)
      .post(`/invoices/${invoiceId}/payments`)
      .reply(409, { message: 'something else' })

    const result = await economyAdapter.recordInvoicePayment(invoiceId, payment)

    expect(result).toMatchObject({ ok: false, err: 'unknown', statusCode: 409 })
  })

  it('returns unknown on unexpected status', async () => {
    nock(config.economyService.url)
      .post(`/invoices/${invoiceId}/payments`)
      .reply(500, {})

    const result = await economyAdapter.recordInvoicePayment(invoiceId, payment)

    expect(result).toMatchObject({ ok: false, err: 'unknown' })
  })

  it('returns unknown on network error', async () => {
    nock(config.economyService.url)
      .post(`/invoices/${invoiceId}/payments`)
      .replyWithError('Connection refused')

    const result = await economyAdapter.recordInvoicePayment(invoiceId, payment)

    expect(result).toMatchObject({ ok: false, err: 'unknown' })
  })

  it('encodes special characters in invoiceId', async () => {
    const encodedId = encodeURIComponent('55/123456')
    nock(config.economyService.url)
      .post(`/invoices/${encodedId}/payments`)
      .reply(200, { content: null })

    const result = await economyAdapter.recordInvoicePayment(
      '55/123456',
      payment
    )

    expect(result).toEqual({ ok: true, data: null })
  })
})
