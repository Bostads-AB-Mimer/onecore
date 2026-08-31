import { MimerCompany } from '@src/common/types/typesv2'
import {
  InvoiceWithAccounting,
  RentalLoss,
  AggregatedRow,
  RentalBlockWithAccounting,
} from '@src/common/types/typesv2'

const mockCompanies: MimerCompany[] = [
  {
    name: 'Mimer',
    xpandId: '001',
    tenfastId: 'tf-001',
    roundOffCostCode: '999',
  },
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

jest.mock(
  '@src/services/invoice-service/adapters/invoice-data-db-adapter',
  () => ({
    getCounterPartCustomers: jest.fn(),
    findCounterPartCustomer: jest.fn(),
  })
)

jest.mock('@src/services/invoice-service/adapters/xpand-db-adapter', () => ({
  getRoundOffInformation: jest.fn(),
  enrichInvoiceWithAccounting: jest.fn(),
  getActiveRentalBlocksWithAccounting: jest.fn(),
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
  handleRentalBlocks,
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
  getActiveRentalBlocksWithAccounting,
} from '@src/services/invoice-service/adapters/xpand-db-adapter'
import { uploadFile } from '@src/services/common/adapters/xledger-adapter'

const mockGetInvoicesNotExported = getInvoicesNotExported as jest.Mock
const mockGetRentalLosses = getRentalLosses as jest.Mock
const mockGetCounterPartCustomers = getCounterPartCustomers as jest.Mock
const mockFindCounterPartCustomer = findCounterPartCustomer as jest.Mock
const mockGetRoundOffInformation = getRoundOffInformation as jest.Mock
const mockGetActiveRentalBlocksWithAccounting =
  getActiveRentalBlocksWithAccounting as jest.Mock
const mockUploadFile = uploadFile as jest.Mock

const buildInvoice = (
  overrides: Partial<InvoiceWithAccounting> = {}
): InvoiceWithAccounting =>
  ({
    invoiceId: '55123456',
    leaseIds: ['705-025-03-0205/01'],
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

      await expect(exportRentalInvoicesAccounting('001')).rejects.toThrow(
        'boom'
      )
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
      const external = buildInvoice({
        invoiceId: 'ext',
        recipientContactCode: 'P1',
      })
      const internal = buildInvoice({
        invoiceId: 'int',
        recipientContactCode: 'I1',
      })

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

  describe('handleRentalBlocks', () => {
    // Summing already-rounded öre amounts leaves float noise; compare at öre.
    const roundToOre = (value: number) => Math.round(value * 100) / 100

    const interval = {
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-07-31T00:00:00.000Z'),
    }

    const buildRentalLoss = (
      overrides: Partial<RentalLoss> = {}
    ): RentalLoss => ({
      rentalObject: 'RO1',
      month: '2026-07',
      days: { totalInMonth: 31, contracted: 0, uncontracted: 31 },
      uncontractedInterval: interval,
      rentalLossRows: [
        {
          amount: 3100,
          totalAmount: 3720,
          vat: 0.2,
          incomeAccount: 3012,
          costAccount: 6100,
        } as any,
      ],
      ...overrides,
    })

    const buildBlock = (
      overrides: Partial<RentalBlockWithAccounting> = {}
    ): RentalBlockWithAccounting => ({
      account: '7300',
      costCode: 'CC1',
      property: 'PROP1',
      projectCode: 'PROJ1',
      freeCode: 'FREE1',
      description: 'Block',
      fromDate: new Date('2026-07-01T00:00:00.000Z'),
      toDate: new Date('2026-07-31T00:00:00.000Z'),
      ...overrides,
    })

    beforeEach(() => {
      mockGetActiveRentalBlocksWithAccounting.mockReset()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([])
    })

    it('returns the rental loss unchanged when there are no active blocks', async () => {
      const rentalLoss = buildRentalLoss()

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result).toEqual(rentalLoss)
      expect(result.rentalLossRows[0].amount).toBe(3100)
    })

    it('replaces the cost side with the block when the block covers the whole period', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([buildBlock()])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(1)
      const row = result.rentalLossRows[0]
      expect(row.isBlock).toBe(true)
      expect(row.fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(row.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      // Amount is unchanged when the block covers the entire interval.
      expect(row.amount).toBe(3100)
      expect(row.totalAmount).toBe(3720)
      // Income side untouched.
      expect(row.incomeAccount).toBe(3012)
      // Cost side carries the block accounting.
      expect(row.costAccount).toBe(7300)
      expect(row.costProjectCode).toBe('PROJ1')
      expect(row.costProperty).toBe('PROP1')
      expect(row.costFreeCode).toBe('FREE1')
      expect(row.costCostCode).toBe('CC1')
    })

    it('prorates by days when the block partially overlaps the loss interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-11T00:00:00.000Z'),
          toDate: new Date('2026-07-31T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(2)

      const gapRow = result.rentalLossRows.find((r) => !r.isBlock)!
      const blockRow = result.rentalLossRows.find((r) => r.isBlock)!

      // Loss gap: 2026-07-01..2026-07-10 = 10 days of 31 -> 3100 * 10/31 ≈ 1000
      expect(gapRow.fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(gapRow.toDate).toEqual(new Date('2026-07-10T00:00:00.000Z'))
      expect(gapRow.amount).toBe(1000)
      expect(gapRow.costAccount).toBe(6100)
      expect(gapRow.isBlock).toBeUndefined()

      // Block portion: 2026-07-11..2026-07-31 = 21 days of 31 -> 3100 * 21/31 ≈ 2100
      expect(blockRow.fromDate).toEqual(new Date('2026-07-11T00:00:00.000Z'))
      expect(blockRow.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      expect(blockRow.amount).toBe(2100)
      expect(blockRow.costAccount).toBe(7300)
    })

    it('splits into block+gap+block when the loss interval is only partially covered', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-05T00:00:00.000Z'),
          toDate: new Date('2026-07-10T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(3)
      // Block portion only spans 6 days.
      const blockRows = result.rentalLossRows.filter((r) => r.isBlock)
      expect(blockRows).toHaveLength(1)
      expect(blockRows[0].fromDate).toEqual(
        new Date('2026-07-05T00:00:00.000Z')
      )
      expect(blockRows[0].toDate).toEqual(new Date('2026-07-10T00:00:00.000Z'))
      // Gap before (4 days) and after (21 days) remain on the original account.
      const gapRows = result.rentalLossRows.filter((r) => !r.isBlock)
      expect(gapRows).toHaveLength(2)
      gapRows.sort((a, b) => a.fromDate!.getTime() - b.fromDate!.getTime())
      expect(gapRows[0].fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(gapRows[0].toDate).toEqual(new Date('2026-07-04T00:00:00.000Z'))
      expect(gapRows[1].fromDate).toEqual(new Date('2026-07-11T00:00:00.000Z'))
      expect(gapRows[1].toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
    })

    it('makes the earliest block win on overlapping blocks', async () => {
      const rentalLoss = buildRentalLoss()
      const earlier = buildBlock({
        account: '7300',
        description: 'earlier',
        fromDate: new Date('2026-07-01T00:00:00.000Z'),
        toDate: new Date('2026-07-15T00:00:00.000Z'),
      })
      const later = buildBlock({
        account: '7400',
        description: 'later',
        fromDate: new Date('2026-07-10T00:00:00.000Z'),
        toDate: new Date('2026-07-31T00:00:00.000Z'),
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        earlier,
        later,
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      // Block 1 covers 1-15 (15 days, earliest wins on the 10-15 overlap)
      // Block 2 covers 16-31 (16 days) where earlier has released the range
      const blockRows = result.rentalLossRows.filter((r) => r.isBlock)
      expect(blockRows).toHaveLength(2)
      blockRows.sort((a, b) => a.fromDate!.getTime() - b.fromDate!.getTime())
      expect(blockRows[0].fromDate).toEqual(
        new Date('2026-07-01T00:00:00.000Z')
      )
      expect(blockRows[0].toDate).toEqual(new Date('2026-07-15T00:00:00.000Z'))
      expect(blockRows[0].costAccount).toBe(7300)
      expect(blockRows[1].fromDate).toEqual(
        new Date('2026-07-16T00:00:00.000Z')
      )
      expect(blockRows[1].toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      expect(blockRows[1].costAccount).toBe(7400)
      // No gaps: the blocks jointly cover the whole interval.
      expect(result.rentalLossRows.filter((r) => !r.isBlock)).toHaveLength(0)
    })

    it('handles multiple distinct non-overlapping blocks with gaps between them', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          account: '7300',
          description: 'first',
          fromDate: new Date('2026-07-03T00:00:00.000Z'),
          toDate: new Date('2026-07-07T00:00:00.000Z'),
        }),
        buildBlock({
          account: '7400',
          description: 'second',
          fromDate: new Date('2026-07-20T00:00:00.000Z'),
          toDate: new Date('2026-07-25T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      // 2 block intervals (3-7, 20-25) + 3 gaps (1-2, 8-19, 26-31)
      const blockRows = result.rentalLossRows
        .filter((r) => r.isBlock)
        .sort((a, b) => a.fromDate!.getTime() - b.fromDate!.getTime())
      const gapRows = result.rentalLossRows
        .filter((r) => !r.isBlock)
        .sort((a, b) => a.fromDate!.getTime() - b.fromDate!.getTime())

      expect(blockRows).toHaveLength(2)
      expect(gapRows).toHaveLength(3)

      expect(blockRows[0].fromDate).toEqual(
        new Date('2026-07-03T00:00:00.000Z')
      )
      expect(blockRows[0].toDate).toEqual(new Date('2026-07-07T00:00:00.000Z'))
      expect(blockRows[0].costAccount).toBe(7300)
      expect(blockRows[1].fromDate).toEqual(
        new Date('2026-07-20T00:00:00.000Z')
      )
      expect(blockRows[1].toDate).toEqual(new Date('2026-07-25T00:00:00.000Z'))
      expect(blockRows[1].costAccount).toBe(7400)

      expect(gapRows[0].fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(gapRows[0].toDate).toEqual(new Date('2026-07-02T00:00:00.000Z'))
      expect(gapRows[1].fromDate).toEqual(new Date('2026-07-08T00:00:00.000Z'))
      expect(gapRows[1].toDate).toEqual(new Date('2026-07-19T00:00:00.000Z'))
      expect(gapRows[2].fromDate).toEqual(new Date('2026-07-26T00:00:00.000Z'))
      expect(gapRows[2].toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      // Gap rows keep the original cost account.
      expect(gapRows.every((r) => r.costAccount === 6100)).toBe(true)

      // The split covers the interval exactly once, with no lost days.
      const totalDays = result.rentalLossRows.reduce(
        (sum, r) =>
          sum +
          (r.toDate!.getTime() - r.fromDate!.getTime()) /
            (24 * 60 * 60 * 1000) +
          1,
        0
      )
      expect(totalDays).toBe(31)
    })

    it('assigns the rounding residual to the last split so the parts sum to the original', async () => {
      // 1000 over a 31-day interval does not divide evenly into any of the
      // splits below, so independent rounding would drift.
      const rentalLoss = buildRentalLoss({
        rentalLossRows: [
          {
            amount: 1000,
            totalAmount: 1250,
            vat: 0.25,
            incomeAccount: 3012,
            costAccount: 6100,
          } as any,
        ],
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          account: '7300',
          description: 'first',
          fromDate: new Date('2026-07-03T00:00:00.000Z'),
          toDate: new Date('2026-07-07T00:00:00.000Z'),
        }),
        buildBlock({
          account: '7400',
          description: 'second',
          fromDate: new Date('2026-07-20T00:00:00.000Z'),
          toDate: new Date('2026-07-25T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(5)
      const sum = result.rentalLossRows.reduce((s, r) => s + r.amount, 0)
      const totalSum = result.rentalLossRows.reduce(
        (s, r) => s + r.totalAmount,
        0
      )
      expect(roundToOre(sum)).toBe(1000)
      expect(roundToOre(totalSum)).toBe(1250)

      // The residual lands on the chronologically last row.
      const last = result.rentalLossRows[result.rentalLossRows.length - 1]
      expect(last.fromDate).toEqual(new Date('2026-07-26T00:00:00.000Z'))
      expect(last.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
    })

    it('keeps each row balanced independently when there are several rows', async () => {
      const rentalLoss = buildRentalLoss({
        rentalLossRows: [
          {
            amount: 1000,
            totalAmount: 1250,
            vat: 0.25,
            incomeAccount: 3012,
            costAccount: 6100,
          } as any,
          {
            amount: 777,
            totalAmount: 971.25,
            vat: 0.25,
            incomeAccount: 3013,
            costAccount: 6200,
          } as any,
        ],
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-03T00:00:00.000Z'),
          toDate: new Date('2026-07-07T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      const byIncomeAccount = (account: number) =>
        result.rentalLossRows.filter((r) => r.incomeAccount === account)

      expect(
        roundToOre(byIncomeAccount(3012).reduce((s, r) => s + r.amount, 0))
      ).toBe(1000)
      expect(
        roundToOre(byIncomeAccount(3013).reduce((s, r) => s + r.amount, 0))
      ).toBe(777)
      expect(
        roundToOre(byIncomeAccount(3013).reduce((s, r) => s + r.totalAmount, 0))
      ).toBe(971.25)
    })

    it('truncates a block that starts before the uncontracted interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-06-15T00:00:00.000Z'),
          toDate: new Date('2026-07-10T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      const blockRow = result.rentalLossRows.find((r) => r.isBlock)!
      // Clamped to the loss start, not the block start.
      expect(blockRow.fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(blockRow.toDate).toEqual(new Date('2026-07-10T00:00:00.000Z'))
      // 10 of 31 days, not the block's own 26 days.
      expect(blockRow.amount).toBe(1000)
    })

    it('truncates a block that ends after the uncontracted interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-21T00:00:00.000Z'),
          toDate: new Date('2026-09-30T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      const blockRow = result.rentalLossRows.find((r) => r.isBlock)!
      expect(blockRow.fromDate).toEqual(new Date('2026-07-21T00:00:00.000Z'))
      // Clamped to the loss end, not the block end.
      expect(blockRow.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      // 11 of 31 days.
      expect(blockRow.amount).toBe(1100)
    })

    it('truncates a block that engulfs the uncontracted interval on both sides', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-05-01T00:00:00.000Z'),
          toDate: new Date('2026-12-31T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      // One row covering exactly the loss interval, no gaps.
      expect(result.rentalLossRows).toHaveLength(1)
      const blockRow = result.rentalLossRows[0]
      expect(blockRow.isBlock).toBe(true)
      expect(blockRow.fromDate).toEqual(new Date('2026-07-01T00:00:00.000Z'))
      expect(blockRow.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      // The full loss amount, never scaled up beyond it.
      expect(blockRow.amount).toBe(3100)
      expect(blockRow.totalAmount).toBe(3720)
    })

    it('truncates each of several blocks that spill outside the uncontracted interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          account: '7300',
          description: 'before',
          fromDate: new Date('2026-06-20T00:00:00.000Z'),
          toDate: new Date('2026-07-05T00:00:00.000Z'),
        }),
        buildBlock({
          account: '7400',
          description: 'after',
          fromDate: new Date('2026-07-25T00:00:00.000Z'),
          toDate: new Date('2026-08-15T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      const blockRows = result.rentalLossRows.filter((r) => r.isBlock)
      expect(blockRows).toHaveLength(2)
      expect(blockRows[0].fromDate).toEqual(
        new Date('2026-07-01T00:00:00.000Z')
      )
      expect(blockRows[0].toDate).toEqual(new Date('2026-07-05T00:00:00.000Z'))
      expect(blockRows[1].fromDate).toEqual(
        new Date('2026-07-25T00:00:00.000Z')
      )
      expect(blockRows[1].toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))

      // 5 + 19 (gap 6-24) + 7 = 31 days, all inside the loss interval.
      const totalDays = result.rentalLossRows.reduce(
        (sum, r) =>
          sum +
          (r.toDate!.getTime() - r.fromDate!.getTime()) /
            (24 * 60 * 60 * 1000) +
          1,
        0
      )
      expect(totalDays).toBe(31)
      expect(
        roundToOre(result.rentalLossRows.reduce((s, r) => s + r.amount, 0))
      ).toBe(3100)
    })

    it('ignores blocks entirely outside the loss interval', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-06-01T00:00:00.000Z'),
          toDate: new Date('2026-06-30T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(1)
      expect(result.rentalLossRows[0].isBlock).toBeUndefined()
      expect(result.rentalLossRows[0].amount).toBe(3100)
    })

    it('treats an open-ended block (null toDate) as covering through the loss interval end', async () => {
      const rentalLoss = buildRentalLoss()
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-11T00:00:00.000Z'),
          toDate: null,
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(2)
      const blockRow = result.rentalLossRows.find((r) => r.isBlock)!
      expect(blockRow.fromDate).toEqual(new Date('2026-07-11T00:00:00.000Z'))
      // Null toDate is capped to the loss interval end.
      expect(blockRow.toDate).toEqual(new Date('2026-07-31T00:00:00.000Z'))
      expect(blockRow.amount).toBe(2100)
    })

    it('splits each rental loss row independently for multiple rows on a rental object', async () => {
      const rentalLoss = buildRentalLoss({
        rentalLossRows: [
          {
            amount: 1000,
            totalAmount: 1200,
            vat: 0.2,
            incomeAccount: 3012,
            costAccount: 6100,
          } as any,
          {
            amount: 2000,
            totalAmount: 2400,
            vat: 0.2,
            incomeAccount: 3013,
            costAccount: 6200,
          } as any,
        ],
      })
      mockGetActiveRentalBlocksWithAccounting.mockResolvedValue([
        buildBlock({
          fromDate: new Date('2026-07-11T00:00:00.000Z'),
          toDate: new Date('2026-07-31T00:00:00.000Z'),
        }),
      ])

      const [result] = await handleRentalBlocks([rentalLoss])

      expect(result.rentalLossRows).toHaveLength(4)
      expect(result.rentalLossRows.filter((r) => r.isBlock)).toHaveLength(2)
      expect(result.rentalLossRows.filter((r) => !r.isBlock)).toHaveLength(2)
    })
  })

  describe('createRentalLossAccounting', () => {
    it('produces an income and cost row per rental loss row', async () => {
      const rentalLosses: RentalLoss[] = [
        {
          rentalObject: 'RO1',
          month: '2026-07',
          days: { totalInMonth: 31, contracted: 0, uncontracted: 31 },
          uncontractedInterval: {
            from: new Date('2026-07-01T00:00:00.000Z'),
            to: new Date('2026-07-31T00:00:00.000Z'),
          },
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
