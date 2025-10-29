const mockRaw = jest.fn()
jest.mock('knex', () => () => ({
  raw: mockRaw,
}))

import { schemas } from '@onecore/types'

import * as adapter from '@src/services/invoice-service/adapters/xpand-db-adapter'

describe(adapter.getInvoiceRows, () => {
  it('returns empty array when no invoice numbers are provided', async () => {
    const result = await adapter.getInvoiceRows(2025, '001', [])
    expect(result).toEqual([])
  })

  it('returns invoice rows when invoice numbers are provided', async () => {
    // Expected result of the invoice row query
    mockRaw.mockResolvedValueOnce([
      {
        p1: 'foo',
        p5: 'foo',
        p4: 'foo',
        text: 'foo',
        roundoff: 0,
        rowtype: 1,
        cmctcben: 'foo',
        cmctckod: 'P12345',
        rentArticle: 'foo',
        printGroup: 'bar',
        printGroupLabel: 'baz',
        rowReduction: 100,
        rowAmount: 100,
        rowVat: 100,
        company: 'company',
        invoiceFromDate: new Date('2025-01-01'),
        invoiceToDate: new Date('2025-01-01'),
        expirationDate: new Date('2025-01-01'),
        invoiceTotal: 100,
        invoice: '1234567890',
        invoiceRowText: 'invoiceRowText',
        invoiceDate: new Date('2025-01-01'),
        invoiceNumber: '1234567890',
        invoiceTotalAmount: 100,
        projectCode: 'projectCode',
      },
    ])

    const result = await adapter.getInvoiceRows(2025, '001', ['1234567890'])

    expect(result).toHaveLength(1)
    expect(() =>
      schemas.v1.InvoiceRowSchema.array().parse(result)
    ).not.toThrow()
  })
})
