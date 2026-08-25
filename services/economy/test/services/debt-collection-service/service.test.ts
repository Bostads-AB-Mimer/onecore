import {
  enrichRentInvoices,
  enrichOtherInvoices,
  enrichBalanceCorrections,
  importInvoicesFromCsv,
  importBalanceCorrectionsFromCsv,
  aggregateRows,
  CsvError,
} from '@src/services/debt-collection-service/service'

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () =>
  require('./__mocks__/tenfast-adapter')
)

jest.mock('@src/services/common/adapters/xledger-adapter', () =>
  require('./__mocks__/xledger-adapter')
)

jest.mock(
  '@src/services/debt-collection-service/converters/generateInkassoSergelFile',
  () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue('mocked-sergel-file-content'),
  })
)

jest.mock(
  '@src/services/debt-collection-service/converters/generateBalanceCorrectionFile',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockReturnValue('mocked-balance-correction-file-content'),
  })
)

import {
  getContactByContactCode,
  getInvoiceByOcr,
  getLease,
  getRentalProperty,
  setupDefaultMocks,
  resetMocks,
  createMockRentInvoiceRow,
  createMockRentInvoice,
} from './__mocks__/tenfast-adapter'

import {
  getCustomers as getXledgerCustomers,
  setupDefaultMocks as setupXledgerDefaultMocks,
  resetMocks as resetXledgerMocks,
} from './__mocks__/xledger-adapter'

import {
  createRentInvoiceCsv,
  createBalanceCorrectionCsv,
  sampleRentInvoiceData,
  sampleBalanceCorrectionData,
  invalidCsvExamples,
} from './test-helpers'

import generateInkassoSergelFile from '@src/services/debt-collection-service/converters/generateInkassoSergelFile'
import generateBalanceCorrectionFile from '@src/services/debt-collection-service/converters/generateBalanceCorrectionFile'

describe('Debt Collection Service', () => {
  beforeEach(() => {
    setupDefaultMocks()
    setupXledgerDefaultMocks()
    ;(generateInkassoSergelFile as jest.Mock).mockClear()
    ;(generateBalanceCorrectionFile as jest.Mock).mockClear()
  })

  afterEach(() => {
    resetMocks()
    resetXledgerMocks()
    jest.clearAllMocks()
  })

  describe('enrichRentInvoices', () => {
    const validCsv = createRentInvoiceCsv([sampleRentInvoiceData])

    it('should process valid CSV and return enriched data', async () => {
      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.file).toBe('mocked-sergel-file-content')
      }

      expect(getContactByContactCode).toHaveBeenCalledWith('CONTACT001')
      expect(getInvoiceByOcr).toHaveBeenCalledWith('INV001')
      expect(getLease).toHaveBeenCalledWith('REN-TAL-00-1001/01')
      expect(getRentalProperty).toHaveBeenCalledWith('REN-TAL-00-1001')

      expect(generateInkassoSergelFile).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Date)
      )
    })

    it('should return error on CSV parsing errors', async () => {
      const result = await enrichRentInvoices(invalidCsvExamples.missingColumns)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(CsvError)
        expect(result.error.message).toContain('Invalid number of columns')
      }
    })

    it('should return error on missing contacts', async () => {
      getContactByContactCode.mockResolvedValueOnce({
        ok: false,
        err: 'not-found',
      })

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('not-found')
      }
    })

    it('should return error on missing invoices', async () => {
      getInvoiceByOcr.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('not-found')
      }
    })

    it('should return error on missing rental properties', async () => {
      getRentalProperty.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
    })

    it('should aggregate invoice rows correctly', async () => {
      const rows = [
        createMockRentInvoiceRow({ printGroup: 'N', amount: 1000 }),
        createMockRentInvoiceRow({
          printGroup: 'N',
          amount: 0,
          deduction: 100,
        }),
        createMockRentInvoiceRow({ printGroup: 'A', amount: 100 }),
        createMockRentInvoiceRow({ printGroup: 'A', amount: 200 }),
        // Row with other printGroup (ungrouped)
        createMockRentInvoiceRow({ printGroup: 'B', amount: 400 }),
        // Row with null printGroup (ungrouped)
        createMockRentInvoiceRow({ printGroup: null, amount: 500 }),
      ]

      const aggregated = aggregateRows(rows)

      expect(aggregated).toHaveLength(4)

      // First group should sum amount + reduction
      expect(aggregated[0].amount).toBe(1100)
      expect(aggregated[0].printGroup).toBe('N')

      // Second group
      expect(aggregated[1].amount).toBe(300)
      expect(aggregated[1].printGroup).toBe('A')

      // Ungrouped row
      expect(aggregated[2].amount).toBe(400)
      expect(aggregated[2].printGroup).toBe('B')

      // Ungrouped row
      expect(aggregated[3].amount).toBe(500)
      expect(aggregated[3].printGroup).toBe(null)
    })

    it('should handle partially paid invoices correctly', async () => {
      const mockRows = [
        createMockRentInvoiceRow({
          amount: 5000,
          printGroup: 'A',
          invoiceRowText: 'Hyra bostad',
        }),
        createMockRentInvoiceRow({
          amount: 0,
          deduction: -500,
          printGroup: 'A',
          invoiceRowText: 'Reduction',
        }),
      ]

      getInvoiceByOcr.mockResolvedValueOnce({
        ok: true,
        data: { invoice: createMockRentInvoice({ invoiceRows: mockRows }) },
      })

      const csvWithPayment = createRentInvoiceCsv([
        {
          ...sampleRentInvoiceData,
          totalAmount: '5700',
          remainingAmount: '1000',
        },
      ])

      const result = await enrichRentInvoices(csvWithPayment)

      expect(result.ok).toBe(true)

      expect(generateInkassoSergelFile).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Date)
      )
    })
  })

  describe('enrichOtherInvoices', () => {
    const validCsv = createRentInvoiceCsv([sampleRentInvoiceData])

    it('should process valid CSV and return enriched data', async () => {
      const result = await enrichOtherInvoices(validCsv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.file).toBe('mocked-sergel-file-content')
      }

      expect(getContactByContactCode).toHaveBeenCalledWith('CONTACT001')
      expect(generateInkassoSergelFile).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Date)
      )
    })

    it('should return error on missing contacts', async () => {
      getContactByContactCode.mockResolvedValueOnce({
        ok: false,
        err: 'not-found',
      })
      getXledgerCustomers.mockResolvedValueOnce([])

      const result = await enrichOtherInvoices(validCsv)

      expect(result.ok).toBe(false)
    })
  })

  describe('enrichBalanceCorrections', () => {
    const validCsv = createBalanceCorrectionCsv([sampleBalanceCorrectionData])

    it('should process valid CSV and return enriched data', async () => {
      const result = await enrichBalanceCorrections(validCsv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.file).toBe('mocked-balance-correction-file-content')
      }

      expect(getInvoiceByOcr).toHaveBeenCalledWith('INV001')
      expect(getLease).toHaveBeenCalledWith('REN-TAL-00-1001/01')
      expect(getRentalProperty).toHaveBeenCalledWith('REN-TAL-00-1001')
      expect(generateBalanceCorrectionFile).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Date)
      )
    })

    it('should return error for invoices without rental properties', async () => {
      getRentalProperty.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await enrichBalanceCorrections(validCsv)

      expect(result.ok).toBe(false)
    })

    it('should return error when invoice is not found', async () => {
      getInvoiceByOcr.mockResolvedValueOnce({ ok: false, err: 'not-found' })

      const result = await enrichBalanceCorrections(validCsv)

      expect(result.ok).toBe(false)
    })
  })

  describe('CSV Parsing Functions', () => {
    describe('importInvoicesFromCsv', () => {
      it('should parse valid CSV correctly', () => {
        const csv = createRentInvoiceCsv([sampleRentInvoiceData])
        const result = importInvoicesFromCsv(csv, ';')

        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
          contactCode: sampleRentInvoiceData.contactCode,
          invoiceNumber: sampleRentInvoiceData.invoiceNumber,
          invoiceDate: new Date(sampleRentInvoiceData.invoiceDate),
          expiryDate: new Date(sampleRentInvoiceData.expiryDate),
          totalAmount: parseFloat(sampleRentInvoiceData.totalAmount),
          remainingAmount: parseFloat(sampleRentInvoiceData.remainingAmount),
          comment: sampleRentInvoiceData.comment,
        })
      })

      it('should handle missing comment field', () => {
        const csvWithoutComment = createRentInvoiceCsv([
          {
            ...sampleRentInvoiceData,
            comment: '',
          },
        ])
        const result = importInvoicesFromCsv(csvWithoutComment, ';')

        expect(result[0].comment).toBeUndefined()
      })

      it('should throw CsvError for invalid column count', () => {
        expect(() => {
          importInvoicesFromCsv(invalidCsvExamples.missingColumns, ';')
        }).toThrow(CsvError)
      })
    })

    describe('importBalanceCorrectionsFromCsv', () => {
      it('should parse valid CSV correctly', () => {
        const csv = createBalanceCorrectionCsv([sampleBalanceCorrectionData])
        const result = importBalanceCorrectionsFromCsv(csv, ';')

        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
          contactCode: sampleBalanceCorrectionData.contactCode,
          type: sampleBalanceCorrectionData.type,
          invoiceNumber: sampleBalanceCorrectionData.invoiceNumber,
          date: new Date(sampleBalanceCorrectionData.date),
          paidAmount: parseFloat(sampleBalanceCorrectionData.paidAmount),
          remainingAmount: parseFloat(
            sampleBalanceCorrectionData.remainingAmount
          ),
        })
      })

      it('should throw CsvError for invalid column count', () => {
        expect(() => {
          importBalanceCorrectionsFromCsv('contactCode;type\nCONTACT001', ';')
        }).toThrow(CsvError)
      })
    })
  })

  describe('Utility Functions', () => {
    describe('aggregateRows', () => {
      it('should group rows by printGroup', () => {
        const rows = [
          createMockRentInvoiceRow({ printGroup: 'N', amount: 1000 }),
          createMockRentInvoiceRow({ printGroup: 'N', amount: 500 }),
          createMockRentInvoiceRow({ printGroup: 'A', amount: 300 }),
        ]
        const result = aggregateRows(rows)
        expect(result).toHaveLength(2)
        expect(result[0].amount).toBe(1500)
        expect(result[0].printGroup).toBe('N')
        expect(result[1].amount).toBe(300)
        expect(result[1].printGroup).toBe('A')
      })

      it('should handle rows with null printGroup individually', () => {
        const rows = [
          createMockRentInvoiceRow({ printGroup: null, amount: 500 }),
          createMockRentInvoiceRow({ printGroup: null, amount: 1000 }),
        ]
        const result = aggregateRows(rows)
        expect(result).toHaveLength(2)
        expect(result[0].amount).toBe(500)
        expect(result[1].amount).toBe(1000)
      })

      it('should sum amount, deduction, and vat for grouped rows', () => {
        const rows = [
          createMockRentInvoiceRow({
            printGroup: 'N',
            amount: 1000,
            deduction: 100,
            vat: 0,
          }),
          createMockRentInvoiceRow({
            printGroup: 'N',
            amount: 500,
            deduction: 50,
            vat: 0,
          }),
        ]
        const result = aggregateRows(rows)
        expect(result).toHaveLength(1)
        expect(result[0].amount).toBe(1650) // (1000+100) + (500+50)
      })

      it('should prefer Hyra bostad or Hyra p-plats as main row', () => {
        const rows = [
          createMockRentInvoiceRow({
            printGroup: 'N',
            invoiceRowText: 'Other text',
          }),
          createMockRentInvoiceRow({
            printGroup: 'N',
            invoiceRowText: 'Hyra bostad',
          }),
        ]
        const result = aggregateRows(rows)
        expect(result).toHaveLength(1)
        expect(result[0].invoiceRowText).toBe('Hyra bostad')
      })

      it('should return empty array when no rows provided', () => {
        const result = aggregateRows([])
        expect(result).toEqual([])
      })
    })
  })

  describe('CsvError', () => {
    it('should create error with message', () => {
      const error = new CsvError('Test error message')
      expect(error.message).toBe('Test error message')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(CsvError)
    })
  })
})
