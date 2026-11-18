import nock from 'nock'

import config from '../../../common/config'
import { getInvoiceFile } from '../../economy-adapter'

afterEach(nock.cleanAll)

describe('economy-adapter.getInvoiceFile', () => {
  it('returns the file bytes', async () => {
    nock(config.economyService.url)
      .get('/invoices/1234567/file')
      .reply(200, Buffer.from('%PDF-1.4 mock'), {
        'Content-Type': 'application/pdf',
      })

    const result = await getInvoiceFile('1234567')

    expect(result).toEqual({ ok: true, data: Buffer.from('%PDF-1.4 mock') })
  })

  it.each(['invoice-not-found', 'file-not-found'] as const)(
    'returns %s from a 404',
    async (reason) => {
      nock(config.economyService.url)
        .get('/invoices/1234567/file')
        .reply(404, { reason })

      const result = await getInvoiceFile('1234567')

      expect(result).toEqual({ ok: false, err: reason })
    }
  )

  it('returns unknown for a server error', async () => {
    nock(config.economyService.url).get('/invoices/1234567/file').reply(500)

    const result = await getInvoiceFile('1234567')

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })
})
