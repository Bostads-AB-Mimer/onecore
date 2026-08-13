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
      reference: 'P123456',
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

  it('does not count invoices billed to a co-holder against the contact', async () => {
    // MIM-1160: the endpoint also returns invoices for shared leases where
    // another contact is the payer (reference = the payer). Those must not
    // fail this contact's credit check.
    const householdInvoices = mockedInvoices.map((i) => ({
      ...i,
      reference: 'P999999',
      sentToDebtCollection: i.expirationDate,
    }))
    nock(config.economyService.url)
      .get(/invoices\/bycontactcode/)
      .reply(200, { content: householdInvoices })

    const result =
      await economyAdapter.getInvoicesSentToDebtCollection('P123456')

    expect(result).toStrictEqual({ ok: true, data: [] })
  })

  describe(economyAdapter.submitMiscellaneousInvoice, () => {
    const invoice = { contactCode: 'P123456' }

    it('returns ok with the created items on success', async () => {
      nock(config.economyService.url)
        .post('/invoices/miscellaneous')
        .reply(200, { content: [{ node: { dbId: 1 } }] })

      const result = await economyAdapter.submitMiscellaneousInvoice(
        invoice,
        undefined
      )

      expect(result).toStrictEqual({
        ok: true,
        data: [{ node: { dbId: 1 } }],
      })
    })

    it('passes through xledger-customer-not-found from economy', async () => {
      nock(config.economyService.url)
        .post('/invoices/miscellaneous')
        .reply(404, { type: 'xledger-customer-not-found' })

      const result = await economyAdapter.submitMiscellaneousInvoice(
        invoice,
        undefined
      )

      expect(result).toStrictEqual({
        ok: false,
        err: 'xledger-customer-not-found',
        statusCode: 404,
      })
    })

    it('returns unknown on other errors', async () => {
      nock(config.economyService.url)
        .post('/invoices/miscellaneous')
        .reply(500, { message: 'boom' })

      const result = await economyAdapter.submitMiscellaneousInvoice(
        invoice,
        undefined
      )

      expect(result).toStrictEqual({ ok: false, err: 'unknown' })
    })
  })
})
