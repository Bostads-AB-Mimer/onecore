import { InvoiceDataRow } from '@src/common/types'

// The real findCounterPartCustomer is used, so its module is loaded
jest.mock('knex', () => () => ({ destroy: jest.fn() }))

jest.mock(
  '@src/services/invoice-service/adapters/invoice-data-db-adapter',
  () => ({
    ...jest.requireActual(
      '@src/services/invoice-service/adapters/invoice-data-db-adapter'
    ),
    getCounterPartCustomers: jest.fn(),
    createBatch: jest.fn(),
    saveContacts: jest.fn(),
    closeDb: jest.fn(),
  })
)
jest.mock('@src/services/invoice-service/adapters/xpand-db-adapter', () => ({
  getRoundOffInformation: jest.fn(),
  getContacts: jest.fn(),
  closeDb: jest.fn(),
}))
jest.mock(
  '@src/services/xpand-rental-invoice-service/adapters/invoice-data-db-adapter',
  () => ({
    saveInvoiceRows: jest.fn(),
    addAccountInformation: jest.fn(),
    getAllInvoiceRows: jest.fn(),
    getInvoicesByChunks: jest.fn(),
    getAggregatedInvoiceRows: jest.fn(),
    getBatchAccountTotals: jest.fn(),
    getImportedInvoiceNumbers: jest.fn(),
    markInvoicesAsImported: jest.fn(),
    verifyImport: jest.fn(),
    closeDb: jest.fn(),
  })
)
jest.mock(
  '@src/services/xpand-rental-invoice-service/adapters/xpand-db-adapter',
  () => ({
    enrichInvoiceRows: jest.fn(),
    getBatchTotalAmount: jest.fn(),
    getInvoiceRows: jest.fn(),
    getRentalInvoices: jest.fn(),
    closeDb: jest.fn(),
  })
)

import {
  cleanInvoiceRows,
  getBatchAggregatedRowsCsv,
  getBatchLedgerRowsCsv,
  importInvoiceRows,
  processInvoiceRows,
  transformAggregatedInvoiceRow,
} from '@src/services/xpand-rental-invoice-service/service'
import {
  createBatch,
  getCounterPartCustomers,
  saveContacts,
} from '@src/services/invoice-service/adapters/invoice-data-db-adapter'
import {
  getContacts,
  getRoundOffInformation,
} from '@src/services/invoice-service/adapters/xpand-db-adapter'
import {
  addAccountInformation,
  getAggregatedInvoiceRows,
  getAllInvoiceRows,
  getBatchAccountTotals,
  getImportedInvoiceNumbers,
  getInvoicesByChunks,
  saveInvoiceRows,
  verifyImport,
} from '@src/services/xpand-rental-invoice-service/adapters/invoice-data-db-adapter'
import {
  enrichInvoiceRows,
  getBatchTotalAmount,
  getInvoiceRows,
  getRentalInvoices,
} from '@src/services/xpand-rental-invoice-service/adapters/xpand-db-adapter'

const counterPartCustomer = {
  customerName: 'Västerås kommunala bolag AB',
  counterPartCode: '123456',
  ledgerAccount: '1599',
  totalAccount: '2899',
}

const createInvoiceDataRow = (
  overrides: InvoiceDataRow = {}
): InvoiceDataRow => ({
  rentArticle: 'HYRAB',
  invoiceRowText: 'Hyra bostad',
  totalAmount: 999.57,
  amount: 999.57,
  vat: 0,
  deduction: 0,
  company: '001',
  invoiceDate: '20250515',
  invoiceDueDate: '20250531',
  invoiceNumber: '55123456',
  contactCode: 'P999999',
  tenantName: 'Västerås kommunala bolag AB',
  account: '3012',
  projectCode: '12345',
  freeCode: '54321',
  roundoff: 0.43,
  fromDate: '20250601',
  toDate: '20250630',
  printGroup: 'A',
  contractCode: '000-000-000/01',
  printGroupLabel: 'Hyra bostad',
  invoiceTotalAmount: 1000,
  rowType: 1,
  ...overrides,
})

beforeEach(() => {
  jest.resetAllMocks()
  ;(getCounterPartCustomers as jest.Mock).mockResolvedValue([
    counterPartCustomer,
  ])
  ;(getRoundOffInformation as jest.Mock).mockResolvedValue({
    account: '3999',
    costCode: '123',
  })
  ;(enrichInvoiceRows as jest.Mock).mockImplementation(
    (rows: InvoiceDataRow[]) => Promise.resolve({ rows, errors: [] })
  )
  ;(addAccountInformation as jest.Mock).mockImplementation(
    (rows: InvoiceDataRow[]) =>
      Promise.resolve(
        rows.map((row) => ({
          ledgerAccount: '1599',
          totalAccount: '2899',
          ...row,
        }))
      )
  )
})

describe(processInvoiceRows, () => {
  it('saves the rows with accounts and a round off row for the invoice', async () => {
    const row = createInvoiceDataRow()

    const result = await processInvoiceRows([row], '1337')

    expect(saveInvoiceRows).toHaveBeenCalledWith(
      [
        { ledgerAccount: '1599', totalAccount: '2899', ...row },
        {
          account: '3999',
          amount: row.roundoff,
          costCode: '123',
          counterPart: '123456',
          contactCode: row.contactCode,
          contractCode: row.contractCode,
          fromDate: row.fromDate,
          invoiceDate: row.invoiceDate,
          invoiceNumber: row.invoiceNumber,
          invoiceRowText: 'Öresutjämning',
          invoiceTotalAmount: row.invoiceTotalAmount,
          ledgerAccount: '1599',
          totalAccount: '2899',
          tenantName: row.tenantName,
          toDate: row.toDate,
          totalAmount: row.roundoff,
        },
      ],
      '1337'
    )
    expect(result).toEqual({ contacts: ['P999999'], errors: [] })
  })

  it('adds no round off row when the invoice has no round off', async () => {
    await processInvoiceRows([createInvoiceDataRow({ roundoff: 0 })], '1337')

    expect(getRoundOffInformation).not.toHaveBeenCalled()
    expect((saveInvoiceRows as jest.Mock).mock.calls[0][0]).toHaveLength(1)
  })
})

describe(cleanInvoiceRows, () => {
  it('removes header rows and sets the contract code from them on the following rows', () => {
    const rows = cleanInvoiceRows([
      { rowType: 3, invoiceRowText: '123-456-789/1, Lägenhet' },
      { rowType: 1, invoiceRowText: 'Hyra' },
      { rowType: 3, invoiceRowText: '987-654-321/1 Bilplats' },
      { rowType: 1, invoiceRowText: 'Hyra bilplats' },
      // A header row not starting with a contract code keeps the current one
      { rowType: 3, invoiceRowText: 'Övrigt' },
      { rowType: 1, invoiceRowText: 'Avgift' },
    ])

    expect(rows).toEqual([
      { rowType: 1, invoiceRowText: 'Hyra', contractCode: '123-456-789/1' },
      {
        rowType: 1,
        invoiceRowText: 'Hyra bilplats',
        contractCode: '987-654-321/1',
      },
      { rowType: 1, invoiceRowText: 'Avgift', contractCode: '987-654-321/1' },
    ])
  })
})

describe(transformAggregatedInvoiceRow, () => {
  const aggregatedRow: InvoiceDataRow = {
    BatchId: 42,
    InvoiceFromDate: '20250601',
    InvoiceToDate: '20250630',
    Account: '3012',
    CostCode: '123',
    ProjectCode: '',
    Property: 'PROP',
    FreeCode: '',
    CounterPart: '',
    TotalAccount: '2970',
    totalAmount: 1250,
    totalVat: 250,
  }

  it('creates an aggregate voucher row with negated amount and tax rule', () => {
    expect(transformAggregatedInvoiceRow(aggregatedRow, 3)).toMatchObject({
      voucherNo: '100042003',
      voucherDate: '20250601',
      account: '3012',
      periodStart: '',
      noOfPeriods: '',
      taxRule: '208',
      amount: -1250,
      totalAccount: '2970',
    })
  })

  it('periodizes an invoice spanning New Year', () => {
    const row = transformAggregatedInvoiceRow(
      {
        ...aggregatedRow,
        InvoiceFromDate: '20251201',
        InvoiceToDate: '20260228',
      },
      0
    )

    expect(row.noOfPeriods).toBe('3')
  })
})

describe(getBatchLedgerRowsCsv, () => {
  it('returns null when the batch has no invoice rows', async () => {
    ;(getAllInvoiceRows as jest.Mock).mockResolvedValueOnce([])

    expect(await getBatchLedgerRowsCsv('1337')).toBeNull()
  })

  it('creates a customer ledger row per invoice and a balancing total row', async () => {
    const dbRow = {
      InvoiceNumber: '55123456',
      InvoiceDate: '20250515',
      InvoiceDueDate: '20250531',
      LedgerAccount: '1530',
      TotalAccount: '2970',
      ContactCode: 'P999999',
      TenantName: 'Test Testsson',
      OCR: '55123456',
      CounterPart: '',
      InvoiceTotalAmount: 1000,
    }
    ;(getAllInvoiceRows as jest.Mock).mockResolvedValueOnce([
      { ...dbRow, TotalAmount: 999.57 },
      { ...dbRow, TotalAmount: 0.43 },
    ])

    const csv = await getBatchLedgerRowsCsv('7')
    const lines = csv?.split('\n') ?? []

    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe(
      'AR;200007000;20250515;1530;;;;;;;;P999999;20250515;55123456;55123456;20250531;;;1000'
    )
    expect(lines[2]).toBe('AR;200007000;20250515;2970;;;;;;;;;;;;;;;-1000')
  })
})

describe(getBatchAggregatedRowsCsv, () => {
  it('returns null when the account totals do not match the batch', async () => {
    ;(getInvoicesByChunks as jest.Mock).mockResolvedValueOnce([
      {
        invoiceNumber: '1',
        invoiceFromDate: '20250601',
        invoiceToDate: '20250630',
        totalAccount: '2970',
      },
    ])
    ;(getAggregatedInvoiceRows as jest.Mock).mockResolvedValueOnce([
      {
        BatchId: 1,
        InvoiceFromDate: '20250601',
        InvoiceToDate: '20250630',
        Account: '3012',
        TotalAccount: '2970',
        totalAmount: 100,
        totalVat: 0,
      },
    ])
    ;(getBatchAccountTotals as jest.Mock).mockResolvedValueOnce({
      '3012': 90,
    })

    expect(await getBatchAggregatedRowsCsv('1')).toBeNull()
  })
})

describe(importInvoiceRows, () => {
  it('returns no batch when every invoice is already imported', async () => {
    ;(getImportedInvoiceNumbers as jest.Mock).mockResolvedValueOnce(['1'])
    ;(getRentalInvoices as jest.Mock).mockResolvedValueOnce(['1'])

    const result = await importInvoiceRows(new Date(), new Date(), '001')

    expect(result).toEqual({
      batchId: null,
      processedInvoices: 0,
      errors: null,
    })
    expect(createBatch).not.toHaveBeenCalled()
  })

  it('imports new invoices and leaves invoices with errors out of the verification', async () => {
    ;(getImportedInvoiceNumbers as jest.Mock).mockResolvedValueOnce(['1'])
    ;(getRentalInvoices as jest.Mock).mockResolvedValueOnce(['1', '2', '3'])
    ;(getBatchTotalAmount as jest.Mock).mockResolvedValueOnce(2000)
    ;(getInvoiceRows as jest.Mock).mockResolvedValueOnce([
      createInvoiceDataRow({ invoiceNumber: '2', roundoff: 0 }),
      createInvoiceDataRow({ invoiceNumber: '3', roundoff: 0 }),
    ])
    ;(createBatch as jest.Mock).mockResolvedValueOnce('99')
    ;(enrichInvoiceRows as jest.Mock).mockImplementationOnce(
      (rows: InvoiceDataRow[]) =>
        Promise.resolve({
          rows: rows.filter((row) => row.invoiceNumber !== '3'),
          errors: [{ invoiceNumber: '3', error: 'Saknar kontering' }],
        })
    )
    ;(getContacts as jest.Mock).mockResolvedValueOnce([])

    const result = await importInvoiceRows(new Date(), new Date(), '001')

    expect(getBatchTotalAmount).toHaveBeenCalledWith(['2', '3'])
    expect(getInvoiceRows).toHaveBeenCalledWith('001', ['2', '3'])
    expect(saveContacts).toHaveBeenCalledWith([], '99')
    expect(verifyImport).toHaveBeenCalledWith(['2'], '99', 2000)
    expect(result).toEqual({
      batchId: '99',
      processedInvoices: 1,
      errors: [{ invoiceNumber: '3', error: 'Saknar kontering' }],
    })
  })
})
