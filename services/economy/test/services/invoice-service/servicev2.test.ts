import { MimerCompany } from '@src/common/types/typesv2'
import {
  InvoiceWithAccounting,
  RentalLoss,
  AggregatedRow,
} from '@src/common/types/typesv2'

const mockCompanies: MimerCompany[] = [
  { name: 'Mimer', xpandId: '001', tenfastId: 'tf-001', roundOffCostCode: '999' },
  { name: 'Other', xpandId: '002', tenfastId: 'tf-002' },
]

jest.mock('@src/common/config', () => ({
  __esModule: true,
  default: { companies: mockCompanies },
}))

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () => ({
  getInvoicesNotExported: jest.fn(),
  getRentalLosses: jest.fn(),
  markInvoicesAsExported: jest.fn(),
}))

jest.mock('@src/services/invoice-service/adapters/invoice-data-db-adapter', () => ({
  getCounterPartCustomers: jest.fn(),
  findCounterPartCustomer: jest.fn(),
}))

jest.mock('@src/services/invoice-service/adapters/xpand-db-adapter', () => ({
  getRoundOffInformation: jest.fn(),
  enrichInvoiceWithAccounting: jest.fn(),
}))

jest.mock('@src/services/common/adapters/xledger-adapter', () => ({
  getPeriodInformationFromDateStrings: jest.fn(() => ({
    periodStart: '',
    periods: '',
  })),
  setInvoiceRowsTaxRule: jest.fn(),
  uploadFile: jest.fn(),
}))

import {
  exportRentalInvoicesAccounting,
  createAccounting,
  createRentalLossAccounting,
  exportRentalLosses,
  uploadCsvFiles,
  uploadRentalLossCsvFile,
  createLedgerRows,
  createAggregatedTotalRow,
} from '@src/services/invoice-service/servicev2'

import {
  getInvoicesNotExported,
  getRentalLosses,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import {
  getCounterPartCustomers,
  findCounterPartCustomer,
} from '@src/services/invoice-service/adapters/invoice-data-db-adapter'
import {
  getRoundOffInformation,
  enrichInvoiceWithAccounting,
} from '@src/services/invoice-service/adapters/xpand-db-adapter'
import { uploadFile } from '@src/services/common/adapters/xledger-adapter'

const mockGetInvoicesNotExported = getInvoicesNotExported as jest.Mock
const mockGetRentalLosses = getRentalLosses as jest.Mock
const mockGetCounterPartCustomers = getCounterPartCustomers as jest.Mock
const mockFindCounterPartCustomer = findCounterPartCustomer as jest.Mock
const mockGetRoundOffInformation = getRoundOffInformation as jest.Mock
const mockUploadFile = uploadFile as jest.Mock

const buildInvoice = (
  overrides: Partial<InvoiceWithAccounting> = {}
): InvoiceWithAccounting =>
  ({
    invoiceId: '55123456',
    leaseId: '705-025-03-0205/01',
    recipientContactCode: 'P123456',
    recipientName: 'Test Tenant',
    amount: 1000,
    totalVat: 0,
    roundoff: 0,
    fromDate: new Date('2026-07-01T00:00:00.000Z'),
    toDate: new Date('2026-07-31T00:00:00.000Z'),
    invoiceDate: new Date('2026-06-15T00:00:00.000Z'),
    expirationDate: new Date('2026-06-30T00:00:00.000Z'),
    invoiceRows: [
      {
        amount: 1000,
        totalAmount: 1000,
        vat: 0,
        deduction: 0,
        account: '3012',
        costCode: '123',
        invoiceRowText: 'Hyra bostad',
      } as any,
    ],
    ...overrides,
  }) as InvoiceWithAccounting

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCounterPartCustomers.mockResolvedValue([])
  mockFindCounterPartCustomer.mockReturnValue(undefined)
  mockGetRoundOffInformation.mockResolvedValue({
    account: '3999',
    costCode: '123',
  })
})

describe('servicev2', () => {
  describe('exportRentalInvoicesAccounting', () => {
    it('throws when the company cannot be found', async () => {
      await expect(exportRentalInvoicesAccounting('999')).rejects.toThrow(
        'Could not find company 999'
      )
    })

    it('throws when the invoices adapter returns an error', async () => {
      mockGetInvoicesNotExported.mockResolvedValue({ ok: false, err: 'boom' })

      await expect(exportRentalInvoicesAccounting('001')).rejects.toThrow('boom')
    })

    it('returns empty result when there are no invoices', async () => {
      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [], errors: undefined },
      })

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices).toEqual([])
      expect(result.skippedInvoices).toEqual([])
    })

    it('skips invoices for internal customers (contact code starting with I)', async () => {
      const external = buildInvoice({ invoiceId: 'ext', recipientContactCode: 'P1' })
      const internal = buildInvoice({ invoiceId: 'int', recipientContactCode: 'I1' })

      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [external, internal], errors: undefined },
      })

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices.map((i) => i.invoiceId)).toEqual(['ext'])
      expect(result.skippedInvoices.map((i) => i.invoiceId)).toEqual(['int'])
    })

    it('collects errors and removes failing invoices from the export', async () => {
      const good = buildInvoice({ invoiceId: 'good' })
      const bad = buildInvoice({ invoiceId: 'bad' })

      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [good, bad], errors: undefined },
      })
      ;(enrichInvoiceWithAccounting as jest.Mock).mockImplementation(
        async (invoice: InvoiceWithAccounting) => {
          if (invoice.invoiceId === 'bad') throw new Error('enrich failed')
        }
      )

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices.map((i) => i.invoiceId)).toEqual(['good'])
      expect(result.errors).toEqual([
        { invoiceNumber: 'bad', error: 'enrich failed' },
      ])
    })

    it('applies counterpart customer accounts when a match is found', async () => {
      const invoice = buildInvoice()
      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [invoice], errors: undefined },
      })
      mockFindCounterPartCustomer.mockReturnValue({
        customerName: 'Test Tenant',
        counterPartCode: 'CP1',
        ledgerAccount: '1510',
        totalAccount: '2440',
      })

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices[0]).toMatchObject({
        ledgerAccount: '1510',
        totalAccount: '2440',
        counterPartCode: 'CP1',
      })
    })

    it('falls back to default accounts when no counterpart matches', async () => {
      const invoice = buildInvoice()
      mockGetInvoicesNotExported.mockResolvedValue({
        ok: true,
        data: { invoices: [invoice], errors: undefined },
      })

      const result = await exportRentalInvoicesAccounting('001')

      expect(result.exportedInvoices[0]).toMatchObject({
        ledgerAccount: '1530',
        totalAccount: '2970',
      })
    })
  })

  describe('createAccounting', () => {
    it('returns aggregate and ledger csv with headers', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
      })

      const result = await createAccounting([invoice])

      expect(result.aggregateAccountingCsv[0]).toContain('Voucher Type')
      expect(result.ledgerAccountingCsv[0]).toContain('Voucher Type')
      expect(result.aggregateAccountingCsv.length).toBeGreaterThan(1)
      expect(result.errors).toEqual([])
    })

    it('includes a round off row when roundoff is non-zero', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
        roundoff: 0.43,
      })

      await createAccounting([invoice])

      expect(mockGetRoundOffInformation).toHaveBeenCalled()
    })
  })

  describe('createLedgerRows', () => {
    it('creates one ledger row per invoice plus a total row per chunk', async () => {
      const invoice = buildInvoice({
        totalAccount: '2970',
        ledgerAccount: '1530',
      })

      const rows = await createLedgerRows([invoice])

      expect(rows).toHaveLength(2)
      expect(rows[0].account).toBe('1530')
      expect(rows[1].account).toBe('2970')
      expect(rows[1].amount).toBe(-1000)
    })
  })

  describe('createAggregatedTotalRow', () => {
    it('sums the negated total amounts of the aggregated rows', () => {
      const rows: AggregatedRow[] = [
        {
          amount: 0,
          totalAmount: -100,
          vat: 0,
          account: '3012',
          voucherDate: '2026-07-01',
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
          totalAccount: '2970',
        },
        {
          amount: 0,
          totalAmount: -50,
          vat: 0,
          account: '3013',
          voucherDate: '2026-07-01',
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
          totalAccount: '2970',
        },
      ]

      const totalRow = createAggregatedTotalRow(rows, 'V1')

      expect(totalRow.account).toBe('2970')
      expect(totalRow.amount).toBe(150)
      expect(totalRow.voucherNumber).toBe('V1')
    })
  })

  describe('exportRentalLosses', () => {
    it('throws when the company cannot be found', async () => {
      await expect(exportRentalLosses('999')).rejects.toThrow(
        'Could not find company 999'
      )
    })

    it('throws when the rental loss adapter returns an error', async () => {
      mockGetRentalLosses.mockResolvedValue({ ok: false, err: 'nope' })

      await expect(exportRentalLosses('001')).rejects.toThrow(
        'Could not retrieve rental loss information: nope'
      )
    })

    it('returns the rental losses on success', async () => {
      const rentalLosses: RentalLoss[] = [{ rentalObject: 'RO1' } as RentalLoss]
      mockGetRentalLosses.mockResolvedValue({
        ok: true,
        data: { rentalLosses },
      })

      const result = await exportRentalLosses('001')

      expect(result).toBe(rentalLosses)
    })
  })

  describe('createRentalLossAccounting', () => {
    it('produces an income and cost row per rental loss row', async () => {
      const rentalLosses: RentalLoss[] = [
        {
          rentalObject: 'RO1',
          month: '2026-07',
          days: { totalInMonth: 31, contracted: 0, uncontracted: 31 },
          uncontractedIntervals: [
            {
              from: new Date('2026-07-01T00:00:00.000Z'),
              to: new Date('2026-07-31T00:00:00.000Z'),
            },
          ],
          rentalLossRows: [
            {
              amount: 100,
              totalAmount: 100,
              vat: 0,
              incomeAccount: 3012,
              costAccount: 6100,
            } as any,
          ],
        },
      ]

      const result = await createRentalLossAccounting(rentalLosses)

      // header + income row + cost row
      expect(result.aggregateRentalLossAccountingCsv).toHaveLength(3)
      expect(result.errors).toEqual([])
    })
  })

  describe('uploadCsvFiles', () => {
    it('throws when the company cannot be found', async () => {
      await expect(uploadCsvFiles('999', [], [])).rejects.toThrow(
        'Could not find company 999'
      )
    })

    it('uploads both the aggregate and ledger files', async () => {
      await uploadCsvFiles('001', ['a'], ['b'])

      expect(mockUploadFile).toHaveBeenCalledTimes(2)
      expect(mockUploadFile.mock.calls[0][0]).toContain('aggregated.gl.csv')
      expect(mockUploadFile.mock.calls[1][0]).toContain('ledger.gl.csv')
    })
  })

  describe('uploadRentalLossCsvFile', () => {
    it('throws when the company cannot be found', async () => {
      await expect(uploadRentalLossCsvFile('999', [])).rejects.toThrow(
        'Could not find company 999'
      )
    })

    it('uploads the rental loss file', async () => {
      await uploadRentalLossCsvFile('001', ['a'])

      expect(mockUploadFile).toHaveBeenCalledTimes(1)
      expect(mockUploadFile.mock.calls[0][0]).toContain('rental-loss.gl.csv')
    })
  })
})
