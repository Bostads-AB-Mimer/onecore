import nock from 'nock'

import config from '../../../common/config'
import * as economyAdapter from '../../economy-adapter'

import { mockedInvoices } from './mocks'

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

  describe('getInvoiceChannels', () => {
    const mockChannels = [
      {
        channel: 'Kivra',
        matchedCandidates: ['P000111'],
        error: null,
      },
      {
        channel: 'eInvoiceB2C',
        matchedCandidates: ['P000222'],
        error: null,
      },
    ]

    it('returns invoice channels for given contact codes', async () => {
      nock(config.economyService.url)
        .post('/invoice-channels', { contactCodes: ['P000111', 'P000222'] })
        .reply(200, { content: mockChannels })

      const result = await economyAdapter.getInvoiceChannels(['P000111', 'P000222'])

      expect(result).toEqual({ ok: true, data: mockChannels })
    })

    it('passes contact codes in request body', async () => {
      nock(config.economyService.url)
        .post('/invoice-channels', { contactCodes: ['P000111', 'P000222', 'F111111'] })
        .reply(200, { content: [] })

      const result = await economyAdapter.getInvoiceChannels(['P000111', 'P000222', 'F111111'])

      expect(result).toEqual({ ok: true, data: [] })
    })

    it('returns empty array when no channels found', async () => {
      nock(config.economyService.url)
        .post('/invoice-channels', { contactCodes: [] })
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
        .post('/invoice-channels', { contactCodes: ['P000111'] })
        .reply(200, { content: channelsWithError })

      const result = await economyAdapter.getInvoiceChannels(['P000111'])

      expect(result).toEqual({ ok: true, data: channelsWithError })
    })
  })
})
