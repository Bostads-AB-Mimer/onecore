import nock from 'nock'

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

  describe('updateXledgerDeferralDate', () => {
    const invoiceId = '55123456'
    const endDate = '2026-06-30'

    it('returns ok when economy service responds 200', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${invoiceId}/xledger-deferral`)
        .reply(200, { content: { ok: true } })

      const result = await economyAdapter.updateXledgerDeferralDate(
        invoiceId,
        endDate
      )

      expect(result).toEqual({ ok: true, data: true })
    })

    it('sends endDate in the request body', async () => {
      let receivedBody: any
      nock(config.economyService.url)
        .put(`/invoices/${invoiceId}/xledger-deferral`, (body) => {
          receivedBody = body
          return true
        })
        .reply(200, { content: { ok: true } })

      await economyAdapter.updateXledgerDeferralDate(invoiceId, endDate)

      expect(receivedBody).toMatchObject({ endDate })
    })

    it('returns unknown when economy service responds with error', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${invoiceId}/xledger-deferral`)
        .reply(500)

      const result = await economyAdapter.updateXledgerDeferralDate(
        invoiceId,
        endDate
      )

      expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
    })

    it('returns unknown on network error', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${invoiceId}/xledger-deferral`)
        .replyWithError('Network error')

      const result = await economyAdapter.updateXledgerDeferralDate(
        invoiceId,
        endDate
      )

      expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
    })
  })

  describe('setTenfastGracePeriod', () => {
    const params = {
      invoiceId: '55123456',
      endDate: '2026-06-30',
      madeByEmail: 'admin@mimer.nu',
      reason: 'Betalningsplan överenskommen.',
    }

    it('returns ok when economy service responds 200', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/tenfast-grace-period`)
        .reply(200, { content: { ok: true } })

      const result = await economyAdapter.setTenfastGracePeriod(params)

      expect(result).toEqual({ ok: true, data: true })
    })

    it('sends endDate, madeByEmail and reason in the request body', async () => {
      let receivedBody: any
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/tenfast-grace-period`, (body) => {
          receivedBody = body
          return true
        })
        .reply(200, { content: { ok: true } })

      await economyAdapter.setTenfastGracePeriod(params)

      expect(receivedBody).toMatchObject({
        endDate: params.endDate,
        madeByEmail: params.madeByEmail,
        reason: params.reason,
      })
    })

    it('returns not-found when economy service responds 404', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/tenfast-grace-period`)
        .reply(404)

      const result = await economyAdapter.setTenfastGracePeriod(params)

      expect(result).toEqual({ ok: false, err: 'not-found', statusCode: 404 })
    })

    it('returns unknown when economy service responds with other error', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/tenfast-grace-period`)
        .reply(500)

      const result = await economyAdapter.setTenfastGracePeriod(params)

      expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
    })

    it('returns unknown on network error', async () => {
      nock(config.economyService.url)
        .put(`/invoices/${params.invoiceId}/tenfast-grace-period`)
        .replyWithError('Network error')

      const result = await economyAdapter.setTenfastGracePeriod(params)

      expect(result).toEqual({ ok: false, err: 'unknown', statusCode: 500 })
    })
  })

  describe('getInvoiceChannels', () => {
    const mockChannels = [
      {
        channel: 'Kivra',
        matchedCandidates: ['191212121212'],
        error: null,
      },
      {
        channel: 'eInvoiceB2C',
        matchedCandidates: ['198112172385'],
        error: null,
      },
    ]

    it('returns invoice channels for given national registration numbers', async () => {
      nock(config.economyService.url)
        .post('/invoice-channels', {
          nationalRegistrationNumbers: ['191212121212', '198112172385'],
        })
        .reply(200, { content: mockChannels })

      const result = await economyAdapter.getInvoiceChannels([
        '191212121212',
        '198112172385',
      ])

      expect(result).toEqual({ ok: true, data: mockChannels })
    })

    it('passes national registration numbers in request body', async () => {
      nock(config.economyService.url)
        .post('/invoice-channels', {
          nationalRegistrationNumbers: [
            '191212121212',
            '198112172385',
            '197102125866',
          ],
        })
        .reply(200, { content: [] })

      const result = await economyAdapter.getInvoiceChannels([
        '191212121212',
        '198112172385',
        '197102125866',
      ])

      expect(result).toEqual({ ok: true, data: [] })
    })

    it('returns empty array when no channels found', async () => {
      nock(config.economyService.url)
        .post('/invoice-channels', { nationalRegistrationNumbers: [] })
        .reply(200, { content: [] })

      const result = await economyAdapter.getInvoiceChannels([])

      expect(result).toEqual({ ok: true, data: [] })
    })

    it('returns channel with error when lookup fails for a candidate', async () => {
      const channelsWithError = [
        {
          channel: 'Kivra',
          matchedCandidates: null,
          error: 'Lookup failed',
        },
      ]

      nock(config.economyService.url)
        .post('/invoice-channels', {
          nationalRegistrationNumbers: ['191212121212'],
        })
        .reply(200, { content: channelsWithError })

      const result = await economyAdapter.getInvoiceChannels(['191212121212'])

      expect(result).toEqual({ ok: true, data: channelsWithError })
    })
  })
})
