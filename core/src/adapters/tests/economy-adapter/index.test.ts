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
