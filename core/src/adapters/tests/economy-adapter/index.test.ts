import nock from 'nock'
import { economy } from '@onecore/types'

import config from '../../../common/config'
import * as economyAdapter from '../../economy-adapter'

import { mockedInvoices } from './mocks'

afterEach(() => {
  nock.cleanAll()
})

describe('economy-adapter', () => {
  it('returns empty list if no problematic invoices', async () => {
    nock(config.economyService.url)
      .get(/invoices\/bycontactcode/)
      .reply(200, { content: mockedInvoices })

    const result =
      await economyAdapter.getInvoicesSentToDebtCollection('P123456')

    expect(result).toStrictEqual({ ok: true, data: [] })
  })

  it('returns list of invoices if current problematic invoices', async () => {
    const mockedProblematicInvoices = mockedInvoices.map((i) => ({
      ...i,
      sentToDebtCollection: i.expirationDate,
    }))
    nock(config.economyService.url)
      .get(/invoices\/bycontactcode/)
      .reply(200, { content: mockedProblematicInvoices })

    const result =
      await economyAdapter.getInvoicesSentToDebtCollection('P123456')

    expect(result).toStrictEqual({
      ok: true,
      data: JSON.parse(JSON.stringify(mockedProblematicInvoices)),
    })
  })

  describe(economyAdapter.deferInvoice, () => {
    const params = {
      invoiceId: '55123456',
      endDate: '2026-06-30',
      madeByEmail: 'admin@mimer.nu',
      reason: 'Betalningsplan överenskommen.',
    }

    it('returns ok when economy service responds 200', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/deferral`)
        .reply(200, { content: { ok: true } })

      const result = await economyAdapter.deferInvoice(params)

      expect(result).toEqual({ ok: true, data: true })
    })

    it('sends endDate, madeByEmail and reason in the request body', async () => {
      let receivedBody: any
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/deferral`, (body) => {
          receivedBody = body
          return true
        })
        .reply(200, { content: { ok: true } })

      await economyAdapter.deferInvoice(params)

      expect(receivedBody).toMatchObject({
        endDate: params.endDate,
        madeByEmail: params.madeByEmail,
        reason: params.reason,
      })
    })

    it('returns invoice-not-found when economy service responds 404', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/deferral`)
        .reply(404, { code: 'invoice-not-found' })

      const result = await economyAdapter.deferInvoice(params)

      expect(result).toEqual({
        ok: false,
        err: 'invoice-not-found',
        statusCode: 404,
      })
    })

    it('returns invoice-not-eligible when economy service responds 422', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/deferral`)
        .reply(422, { code: 'invoice-not-eligible' })

      const result = await economyAdapter.deferInvoice(params)

      expect(result).toEqual({
        ok: false,
        err: 'invoice-not-eligible',
        statusCode: 422,
      })
    })

    it('returns tenfast-failed when economy service responds 500 with that code', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/deferral`)
        .reply(500, { code: 'tenfast-failed' })

      const result = await economyAdapter.deferInvoice(params)

      expect(result).toEqual({
        ok: false,
        err: 'tenfast-failed',
        statusCode: 500,
      })
    })

    it('returns unknown on network error', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/deferral`)
        .replyWithError('Network error')

      const result = await economyAdapter.deferInvoice(params)

      expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
    })
  })

  describe('getInvoiceChannels', () => {
    const recipients: economy.LookupRecipient[] = [
      { recipientId: '191212121212', recipientType: 'individual' },
      { recipientId: '198112172385', recipientType: 'individual' },
    ]

    const mockChannels = {
      candidates: [
        {
          referenceId: '191212121212',
          availableInChannels: ['Kivra'],
          notAvailableInChannels: ['eInvoiceB2C'],
        },
        {
          referenceId: '198112172385',
          availableInChannels: ['eInvoiceB2C'],
          notAvailableInChannels: ['Kivra'],
        },
      ],
    }

    it('returns invoice channels for given recipients', async () => {
      nock(config.economyService.url)
        .post('/invoice-channels', { recipients })
        .reply(200, { content: mockChannels })

      const result = await economyAdapter.getInvoiceChannels(recipients)

      expect(result).toEqual({ ok: true, data: mockChannels })
    })

    it('passes recipients in request body', async () => {
      const threeRecipients: economy.LookupRecipient[] = [
        ...recipients,
        { recipientId: '5512345678', recipientType: 'organization' },
      ]

      nock(config.economyService.url)
        .post('/invoice-channels', { recipients: threeRecipients })
        .reply(200, { content: { candidates: [] } })

      const result = await economyAdapter.getInvoiceChannels(threeRecipients)

      expect(result).toEqual({ ok: true, data: { candidates: [] } })
    })

    it('returns channelErrors alongside candidates', async () => {
      const mockWithErrors = {
        candidates: [
          {
            referenceId: '191212121212',
            availableInChannels: ['Kivra'],
            notAvailableInChannels: [],
          },
        ],
        channelErrors: [{ channel: 'eInvoiceB2C', error: 'timeout' }],
      }

      nock(config.economyService.url)
        .post('/invoice-channels', { recipients: [recipients[0]] })
        .reply(200, { content: mockWithErrors })

      const result = await economyAdapter.getInvoiceChannels([recipients[0]])

      expect(result).toEqual({ ok: true, data: mockWithErrors })
    })

    it('returns unknown error when lookup fails', async () => {
      nock(config.economyService.url)
        .post('/invoice-channels', { recipients: [recipients[0]] })
        .reply(500, { message: 'Lookup failed' })

      const result = await economyAdapter.getInvoiceChannels([recipients[0]])

      expect(result).toEqual({
        ok: false,
        err: 'Lookup failed',
      })
    })
  })
})
