import {
  createVoucherNumbers,
  getFirstChunkNumber,
  getVoucherPrefix,
  importNewFiles,
  summarizeExportedInvoices,
} from '@src/services/procurement-invoice-service/service'
import { getNewProcurementInvoiceRows } from '@src/services/procurement-invoice-service/adapters/procurement-file-adapter'
import { enrichProcurementInvoiceRows } from '@src/services/procurement-invoice-service/adapters/xpand-db-adapter'
import {
  getCounterPartCustomers,
  getExportedInvoiceNumbers,
  getLastVoucherNumber,
} from '@src/services/procurement-invoice-service/adapters/invoice-data-db-adapter'
import { InvoiceDataRow } from '@src/common/types'

jest.mock(
  '@src/services/procurement-invoice-service/adapters/procurement-file-adapter',
  () => ({ getNewProcurementInvoiceRows: jest.fn() })
)
jest.mock(
  '@src/services/procurement-invoice-service/adapters/xpand-db-adapter',
  () => ({ enrichProcurementInvoiceRows: jest.fn(), closeDb: jest.fn() })
)
jest.mock(
  '@src/services/procurement-invoice-service/adapters/invoice-data-db-adapter',
  () => ({
    getCounterPartCustomers: jest.fn(),
    getExportedInvoiceNumbers: jest.fn(),
    getLastVoucherNumber: jest.fn(),
    closeDb: jest.fn(),
  })
)

const invoiceRows = (
  invoiceNumber: string,
  amount: number
): InvoiceDataRow[] => [
  {
    invoiceNumber,
    account: '2460',
    totalAmount: -amount,
    invoiceDate: '2026-10-06',
    dueDate: '2026-11-05',
    periodStart: '',
    numPeriods: '',
    subledgerNumber: '53984290',
  },
  {
    invoiceNumber,
    account: '4611',
    totalAmount: amount,
    invoiceDate: '2026-10-06',
    dueDate: '2026-11-05',
    periodStart: '',
    numPeriods: '',
    subledgerNumber: '53984290',
  },
]

describe('getVoucherPrefix', () => {
  it('pads the day of year to three digits', () => {
    expect(getVoucherPrefix(new Date(2026, 0, 5))).toBe('326005')
    expect(getVoucherPrefix(new Date(2026, 3, 10))).toBe('326100')
    expect(getVoucherPrefix(new Date(2026, 9, 6))).toBe('326279')
  })
})

describe('getFirstChunkNumber', () => {
  it('starts at 1 when nothing has been exported today', async () => {
    ;(getLastVoucherNumber as jest.Mock).mockResolvedValue(undefined)
    expect(await getFirstChunkNumber('326279')).toBe(1)
  })

  it('continues after the last voucher exported today', async () => {
    ;(getLastVoucherNumber as jest.Mock).mockResolvedValue('326279004')
    expect(await getFirstChunkNumber('326279')).toBe(5)
  })
})

describe('createVoucherNumbers', () => {
  it('numbers vouchers from the given first chunk number', () => {
    const rows = createVoucherNumbers(
      [...invoiceRows('1', 100), ...invoiceRows('2', 200)],
      '326279',
      5
    )
    expect(rows.map((row) => row.voucherNo)).toEqual([
      '326279005',
      '326279005',
      '326279005',
      '326279005',
    ])
  })

  it('throws when the day runs out of voucher numbers', () => {
    expect(() =>
      createVoucherNumbers(invoiceRows('1', 100), '326279', 1000)
    ).toThrow(/exhausted/)
  })
})

describe('summarizeExportedInvoices', () => {
  it('returns one entry per invoice with the supplier ledger amount', () => {
    const rows = createVoucherNumbers(
      [...invoiceRows('1', 100), ...invoiceRows('2', 200)],
      '326279'
    )
    expect(summarizeExportedInvoices(rows)).toEqual([
      { invoiceNumber: '1', voucherNo: '326279001', amount: -100 },
      { invoiceNumber: '2', voucherNo: '326279001', amount: -200 },
    ])
  })
})

describe('importNewFiles', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(getCounterPartCustomers as jest.Mock).mockResolvedValue([])
    ;(getLastVoucherNumber as jest.Mock).mockResolvedValue(undefined)
    ;(enrichProcurementInvoiceRows as jest.Mock).mockImplementation(
      async (rows: InvoiceDataRow[]) => ({ rows, missingFacilities: {} })
    )
  })

  it('skips invoices that have already been exported', async () => {
    ;(getNewProcurementInvoiceRows as jest.Mock).mockResolvedValue({
      rows: [...invoiceRows('1', 100), ...invoiceRows('2', 200)],
      filenames: ['a.xml', 'b.xml'],
    })
    ;(getExportedInvoiceNumbers as jest.Mock).mockResolvedValue(new Set(['1']))

    const result = await importNewFiles()

    expect(result.alreadyExported).toEqual(['1'])
    expect(result.exportedInvoices.map((i) => i.invoiceNumber)).toEqual(['2'])
    expect(result.filenames).toEqual(['a.xml', 'b.xml'])
    expect(result.csvLines).toHaveLength(3) // header + two rows for invoice 2
    expect(result.csvLines?.slice(1).every((l) => l.includes(';2;2;'))).toBe(
      true
    )
  })

  it('returns no csv but keeps the filenames when everything was already exported', async () => {
    ;(getNewProcurementInvoiceRows as jest.Mock).mockResolvedValue({
      rows: invoiceRows('1', 100),
      filenames: ['a.xml'],
    })
    ;(getExportedInvoiceNumbers as jest.Mock).mockResolvedValue(new Set(['1']))

    const result = await importNewFiles()

    expect(result.csvLines).toBeNull()
    expect(result.alreadyExported).toEqual(['1'])
    expect(result.filenames).toEqual(['a.xml'])
    expect(enrichProcurementInvoiceRows).not.toHaveBeenCalled()
  })

  it('continues voucher numbering from earlier runs the same day', async () => {
    ;(getNewProcurementInvoiceRows as jest.Mock).mockResolvedValue({
      rows: invoiceRows('1', 100),
      filenames: ['a.xml'],
    })
    ;(getExportedInvoiceNumbers as jest.Mock).mockResolvedValue(new Set())
    ;(getLastVoucherNumber as jest.Mock).mockImplementation(
      async (prefix: string) => `${prefix}003`
    )

    const result = await importNewFiles()

    expect(result.exportedInvoices[0].voucherNo).toBe(
      `${getVoucherPrefix()}004`
    )
  })
})
