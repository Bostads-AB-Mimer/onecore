const mockRaw = jest.fn()
jest.mock('knex', () => () => ({
  raw: mockRaw,
}))

import { schemas } from '@onecore/types'

import * as adapter from '@src/services/invoice-service/adapters/xpand-db-adapter'

describe(adapter.getInvoiceRows, () => {
  it('returns empty array when no invoice numbers are provided', async () => {
    const result = await adapter.getInvoiceRows('001', [])
    expect(result).toEqual([])
  })

  const baseRow = {
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
    invoiceToDate: new Date('2025-01-31'),
    expirationDate: new Date('2025-02-28'),
    invoiceTotal: 100,
    invoice: '1234567890',
    invdate: new Date('2025-01-15'),
    type: 1,
  }

  const now = new Date()
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const pad = (n: number) => String(n).padStart(2, '0')
  const y = now.getFullYear()
  const m = pad(now.getMonth() + 1)
  const lastDay = pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())
  const startOfCurrentMonthString = `${y}${m}01`
  const endOfCurrentMonthString = `${y}${m}${lastDay}`

  // toXledger matches xledgerDateString (UTC-based), used for pass-through assertions
  const toXledger = (d: Date) =>
    d.toISOString().substring(0, 10).replaceAll('-', '')

  it('returns invoice rows when invoice numbers are provided', async () => {
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: new Date('2025-01-01') },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result).toHaveLength(1)
    expect(() =>
      schemas.v1.InvoiceRowSchema.array().parse(result)
    ).not.toThrow()
  })

  it('uses first of current month as fromDate when invoiceFromDate is in a past month', async () => {
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: new Date('2025-01-01') },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].fromDate).toBe(startOfCurrentMonthString)
  })

  it('uses last day of current month as toDate when invoiceToDate is in a past month', async () => {
    mockRaw.mockResolvedValueOnce([
      {
        ...baseRow,
        invoiceFromDate: startOfCurrentMonth,
        invoiceToDate: new Date('2025-01-31'),
      },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].toDate).toBe(endOfCurrentMonthString)
  })

  it('uses invoiceFromDate as fromDate when it is in the current month', async () => {
    const currentMonthFromDate = new Date(now.getFullYear(), now.getMonth(), 10)
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: currentMonthFromDate },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].fromDate).toBe(toXledger(currentMonthFromDate))
  })

  it('uses invoiceToDate as toDate when it is in the current month', async () => {
    const currentMonthToDate = new Date(now.getFullYear(), now.getMonth(), 20)
    mockRaw.mockResolvedValueOnce([
      {
        ...baseRow,
        invoiceFromDate: startOfCurrentMonth,
        invoiceToDate: currentMonthToDate,
      },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].toDate).toBe(toXledger(currentMonthToDate))
  })

  it('uses invoiceFromDate as fromDate when it is in a future month', async () => {
    const futureFromDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: futureFromDate },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].fromDate).toBe(toXledger(futureFromDate))
  })

  it('uses invoiceToDate as toDate when it is in a future month', async () => {
    const futureToDate = new Date(now.getFullYear(), now.getMonth() + 1, 28)
    mockRaw.mockResolvedValueOnce([
      {
        ...baseRow,
        invoiceFromDate: startOfCurrentMonth,
        invoiceToDate: futureToDate,
      },
    ])

    const result = await adapter.getInvoiceRows('001', ['1234567890'])

    expect(result[0].toDate).toBe(toXledger(futureToDate))
  })
})
