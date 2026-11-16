import nock from 'nock'
import { economy } from '@onecore/types'

import config from '../../../common/config'
import * as economyAdapter from '../../economy-adapter'

const openInvoice: economy.OpenInvoice = {
  invoiceNumber: '55123456',
  ocr: '5512345601',
  invoiceDate: '2026-10-15',
  dueDate: '2026-11-01',
  amount: 8000,
  remainingAmount: 5000,
  rentalObjectCode: '306-008-01-0201',
  leaseId: '306-008-01-0201/02',
  contactCode: 'P123456',
  state: 'overdue',
  costCentre: '61110',
}

afterEach(() => {
  nock.cleanAll()
})

describe(economyAdapter.getOpenInvoices, () => {
  it('returns the open invoices', async () => {
    nock(config.economyService.url)
      .get('/invoices/open')
      .reply(200, { content: [openInvoice] })

    const result = await economyAdapter.getOpenInvoices()

    expect(result).toEqual({ ok: true, data: [openInvoice] })
  })

  it('maps 503 to upstream-failed', async () => {
    nock(config.economyService.url)
      .get('/invoices/open')
      .reply(503, { error: 'upstream-failed' })

    const result = await economyAdapter.getOpenInvoices()

    expect(result).toMatchObject({ ok: false, err: 'upstream-failed' })
  })

  it('maps any other status to unknown', async () => {
    nock(config.economyService.url).get('/invoices/open').reply(500, {})

    const result = await economyAdapter.getOpenInvoices()

    expect(result).toMatchObject({ ok: false, err: 'unknown' })
  })

  it('gives unknown, never success, for a 200 that does not parse', async () => {
    nock(config.economyService.url)
      .get('/invoices/open')
      .reply(200, { content: [{ ...openInvoice, state: 'ny' }] })

    const result = await economyAdapter.getOpenInvoices()

    expect(result).toMatchObject({ ok: false, err: 'unknown' })
  })
})
