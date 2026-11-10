const mockRaw = jest.fn()
const mockDb = Object.assign(jest.fn(), { raw: mockRaw, destroy: jest.fn() })

jest.mock('knex', () => () => mockDb)
jest.mock('@src/services/invoice-service/adapters/xpand-db-adapter', () => ({
  getRentalSpecificRules: jest.fn(),
}))

import * as adapter from '@src/services/xpand-rental-invoice-service/adapters/xpand-db-adapter'
import { getRentalSpecificRules } from '@src/services/invoice-service/adapters/xpand-db-adapter'
import { InvoiceDataRow, Invoice } from '@src/common/types'

const mockGetRentalSpecificRules = getRentalSpecificRules as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
})

describe(adapter.getRentalInvoices, () => {
  it('passes the company and dates as bindings and trims the invoice numbers', async () => {
    mockRaw.mockResolvedValueOnce([{ invoice: '5512345   ' }])
    const from = new Date('2025-01-01')
    const to = new Date('2025-06-01')

    const result = await adapter.getRentalInvoices(from, to, '006')

    expect(result).toEqual(['5512345'])
    expect(mockRaw.mock.calls[0][0]).toContain(
      'repsr.keycode IN (CAST(? AS CHAR(15)),CAST(? AS CHAR(15)))'
    )
    expect(mockRaw.mock.calls[0][1]).toEqual([
      'FADBT_INTHYRA',
      'FADBT_HYRA',
      '006',
      from,
      to,
    ])
  })
})

describe(adapter.getBatchTotalAmount, () => {
  it('sums the totals of invoice number chunks', async () => {
    const invoiceNumbers = Array.from({ length: 1500 }, (_, i) => `${i}`)
    mockRaw
      .mockResolvedValueOnce([{ invoicesTotal: 100.5 }])
      .mockResolvedValueOnce([{ invoicesTotal: null }])

    const total = await adapter.getBatchTotalAmount(invoiceNumbers)

    expect(total).toBe(100.5)
    expect(mockRaw).toHaveBeenCalledTimes(2)
    expect(mockRaw.mock.calls[0][1]).toHaveLength(1000)
    expect(mockRaw.mock.calls[1][1]).toHaveLength(500)
  })
})

describe(adapter.getInvoiceRows, () => {
  const baseRow = {
    p1: '3012 ',
    p4: '12345',
    p5: null,
    text: 'Hyra bostad  ',
    roundoff: 0.43,
    rowtype: 1,
    cmctcben: 'Test Testsson  ',
    cmctckod: 'P12345  ',
    rentArticle: 'HYRAB',
    printGroup: 'A',
    printGroupLabel: 'Hyra',
    rowReduction: -100,
    rowAmount: 1000,
    rowVat: 0,
    company: '001',
    invoiceFromDate: new Date('2025-01-01'),
    invoiceToDate: new Date('2025-01-31'),
    expirationDate: new Date('2025-02-28'),
    invoiceTotal: 900.43,
    invoice: '55123456  ',
    invdate: new Date('2025-01-15'),
    type: 1,
  }

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = now.getUTCFullYear()
  const m = pad(now.getUTCMonth() + 1)
  const lastDay = pad(
    new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
    ).getUTCDate()
  )

  it('returns empty array when no invoice numbers are provided', async () => {
    expect(await adapter.getInvoiceRows('001', [])).toEqual([])
    expect(mockRaw).not.toHaveBeenCalled()
  })

  it('returns trimmed invoice data rows with accounting, contact and tenant', async () => {
    mockRaw.mockResolvedValueOnce([baseRow])

    const [row] = await adapter.getInvoiceRows('001', ['55123456'])

    expect(row).toEqual({
      account: '3012',
      amount: 1000,
      company: '001',
      contactCode: 'P12345',
      deduction: -100,
      fromDate: `${y}${m}01`,
      invoiceDate: '20250115',
      invoiceDueDate: '20250228',
      invoiceNumber: '55123456',
      invoiceRowText: 'Hyra bostad',
      invoiceTotalAmount: 900.43,
      printGroup: 'A',
      printGroupLabel: 'Hyra',
      projectCode: '12345',
      rentArticle: 'HYRAB',
      roundoff: 0.43,
      rowType: 1,
      tenantName: 'Test Testsson',
      toDate: `${y}${m}${lastDay}`,
      totalAmount: 900,
      vat: 0,
    })
    // Null columns are left out
    expect(row).not.toHaveProperty('freeCode')
  })

  it('reverses the signs of credit invoice rows', async () => {
    mockRaw.mockResolvedValueOnce([{ ...baseRow, type: 2 }])

    const [row] = await adapter.getInvoiceRows('001', ['55123456'])

    expect(row).toMatchObject({
      amount: -1000,
      deduction: 100,
      totalAmount: -900,
      invoiceTotalAmount: -900.43,
      roundoff: -0.43,
    })
  })

  it('keeps dates that are not in a past month', async () => {
    const future = new Date(Date.UTC(y + 1, 0, 1))
    const futureEnd = new Date(Date.UTC(y + 1, 0, 31))
    mockRaw.mockResolvedValueOnce([
      { ...baseRow, invoiceFromDate: future, invoiceToDate: futureEnd },
    ])

    const [row] = await adapter.getInvoiceRows('001', ['55123456'])

    expect(row.fromDate).toBe(`${y + 1}0101`)
    expect(row.toDate).toBe(`${y + 1}0131`)
  })

  it('queries the invoice numbers sorted, in chunks, as bindings', async () => {
    const invoiceNumbers = Array.from({ length: 1001 }, (_, i) =>
      String(2000 - i)
    )
    mockRaw.mockResolvedValue([])

    await adapter.getInvoiceRows('006', invoiceNumbers)

    expect(mockRaw).toHaveBeenCalledTimes(2)
    const [firstSql, firstBindings] = mockRaw.mock.calls[0]
    expect(firstSql).not.toContain('2000')
    expect(firstBindings.slice(0, 3)).toEqual(['FADBT_HYRA', '006', '1000'])
    expect(firstBindings).toHaveLength(1002)
    expect(mockRaw.mock.calls[1][1]).toEqual(['FADBT_HYRA', '006', '2000'])
  })
})

describe(adapter.enrichInvoiceRows, () => {
  const xpandInvoice: Invoice = {
    invdate: '20250115',
    fromdate: '20250101',
    todate: '20250131',
    expdate: '20250228',
  }

  const createRow = (
    invoiceNumber: string,
    contractCode: string,
    fromDate = '20250101'
  ): InvoiceDataRow => ({
    invoiceNumber,
    contractCode,
    company: '001',
    fromDate,
  })

  it('drops every row of an invoice when any of its rows fails enrichment', async () => {
    mockGetRentalSpecificRules.mockResolvedValue({
      '000-A': { costCode: 'COSTCODE-A', property: 'PROPERTY-A' },
    })

    const result = await adapter.enrichInvoiceRows(
      [createRow('INV-1', '000-A/01'), createRow('INV-1', '000-B/01')],
      { 'INV-1': xpandInvoice }
    )

    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].invoiceNumber).toBe('INV-1')
  })

  it('keeps rows of a fully-successful invoice when a different invoice fails', async () => {
    mockGetRentalSpecificRules.mockResolvedValue({
      '000-A': { costCode: 'COSTCODE-A', property: 'PROPERTY-A' },
    })

    const result = await adapter.enrichInvoiceRows(
      [
        createRow('INV-1', '000-A/01'),
        createRow('INV-1', '000-A/02'),
        createRow('INV-2', '000-B/01'),
      ],
      { 'INV-1': xpandInvoice, 'INV-2': xpandInvoice }
    )

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      invoiceNumber: 'INV-1',
      costCode: 'COSTCODE-A',
      property: 'PROPERTY-A',
      invoiceDate: '20250115',
      invoiceDueDate: '20250228',
    })
    expect(result.errors).toEqual([
      expect.objectContaining({ invoiceNumber: 'INV-2' }),
    ])
  })

  it('records an error and excludes the rows when an invoice is not found in Xpand', async () => {
    mockGetRentalSpecificRules.mockResolvedValue({})

    const result = await adapter.enrichInvoiceRows(
      [createRow('INV-MISSING', '000-A/01')],
      {}
    )

    expect(result.rows).toHaveLength(0)
    expect(result.errors.some((e) => e.invoiceNumber === 'INV-MISSING')).toBe(
      true
    )
  })

  it('gets the accounting rules for each year the rows start in', async () => {
    mockGetRentalSpecificRules.mockImplementation(
      (_rentalIds: string[], year: string) =>
        Promise.resolve({
          '000-A': { costCode: `COST-${year}`, property: 'PROPERTY-A' },
        })
    )

    const result = await adapter.enrichInvoiceRows(
      [createRow('INV-1', '000-A/01', '20261201')],
      { 'INV-1': xpandInvoice }
    )

    expect(mockGetRentalSpecificRules).toHaveBeenCalledTimes(1)
    expect(mockGetRentalSpecificRules).toHaveBeenCalledWith(['000-A'], '2026')
    expect(result.rows[0].costCode).toBe('COST-2026')
  })
})
