import {
  enrichRentInvoices,
  enrichOtherInvoices,
  enrichBalanceCorrections,
  importInvoicesFromCsv,
  importBalanceCorrectionsFromCsv,
  addRoundoffToFirstRow,
  aggregateRows,
  CsvError,
} from '../service'

// Mock the database adapter
jest.mock('../adapters/xpand-db-adapter', () =>
  require('./__mocks__/xpand-db-adapter')
)

// Mock the file generators
jest.mock('../converters/generateInkassoSergelFile', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue('mocked-sergel-file-content'),
}))

jest.mock('../converters/generateBalanceCorrectionFile', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue('mocked-balance-correction-file-content'),
}))

import {
  getContacts,
  getInvoices,
  getRentalProperties,
  getInvoiceRows,
  setupDefaultMocks,
  resetMocks,
  createMockRentInvoiceRow,
} from './__mocks__/xpand-db-adapter'

import {
  createRentInvoiceCsv,
  createBalanceCorrectionCsv,
  sampleRentInvoiceData,
  sampleBalanceCorrectionData,
  invalidCsvExamples,
} from './test-helpers'

import generateInkassoSergelFile from '../converters/generateInkassoSergelFile'
import generateBalanceCorrectionFile from '../converters/generateBalanceCorrectionFile'

describe('Debt Collection Service', () => {
  beforeEach(() => {
    setupDefaultMocks()
    ;(generateInkassoSergelFile as jest.Mock).mockClear()
    ;(generateBalanceCorrectionFile as jest.Mock).mockClear()
  })

  afterEach(() => {
    resetMocks()
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

      // Verify database calls were made with correct parameters
      expect(getContacts).toHaveBeenCalledWith(['CONTACT001'])
      expect(getInvoices).toHaveBeenCalledWith(['INV001'])
      expect(getInvoiceRows).toHaveBeenCalledWith(['INV001'])
      expect(getRentalProperties).toHaveBeenCalledWith(['RENTAL001'])

      // Verify file generator was called
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
      getContacts.mockResolvedValueOnce([])

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Contact not found')
        expect(result.error.message).toContain('CONTACT001')
      }
    })

    it('should return error on missing invoices', async () => {
      getInvoices.mockResolvedValueOnce([])

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Invoice not found')
        expect(result.error.message).toContain('INV001')
      }
    })

    it('should return error on missing rental properties', async () => {
      getRentalProperties.mockResolvedValueOnce([])

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Rental property not found')
        expect(result.error.message).toContain('INV001')
      }
    })

    it('should aggregate invoice rows correctly', async () => {
      const rows = [
        createMockRentInvoiceRow({ printGroup: 'N', amount: 1000 }),
        createMockRentInvoiceRow({
          printGroup: 'N',
          amount: 0,
          reduction: 100,
        }),
        createMockRentInvoiceRow({ printGroup: 'A', amount: 100 }),
        createMockRentInvoiceRow({ printGroup: 'O', amount: 200 }), // Will be mapped to N
        createMockRentInvoiceRow({ printGroup: 'E', amount: 300 }), // Will be mapped to A
        createMockRentInvoiceRow({ printGroup: 'X', amount: 100 }),
      ]

      const aggregated = aggregateRows(rows)

      expect(aggregated).toHaveLength(3)

      const groupN = aggregated.find((row) => row.printGroup === 'N')
      expect(groupN?.amount).toBe(1300)

      const groupE = aggregated.find((row) => row.printGroup === 'A')
      expect(groupE?.amount).toBe(400)

      const groupX = aggregated.find((row) => row.printGroup === 'X')
      expect(groupX?.amount).toBe(100)
    })

    it('should handle partially paid invoices correctly', async () => {
      const mockRows = [
        createMockRentInvoiceRow({
          rentType: 'Hyra bostad',
          amount: 5000,
          type: 'Rent',
          printGroup: 'A',
        }),
        createMockRentInvoiceRow({
          rentType: 'Hyra bostad',
          amount: 0,
          reduction: -500,
          type: 'Rent',
          printGroup: 'A',
        }),
        createMockRentInvoiceRow({
          rentType: 'Hyra bilplats',
          amount: 700,
          type: 'Rent',
          printGroup: 'B',
        }),
        createMockRentInvoiceRow({
          rentType: 'Hemförsäkring',
          amount: 500,
          type: 'Other',
          printGroup: 'C',
        }),
      ]

      getInvoiceRows.mockResolvedValueOnce(mockRows)

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
        expect.arrayContaining([
          expect.objectContaining({
            invoice: expect.objectContaining({
              amount: 1000,
              rows: expect.arrayContaining([
                expect.objectContaining({
                  rentType: 'Hyra bilplats',
                  amount: 500,
                }),
                expect.objectContaining({
                  rentType: 'Hemförsäkring',
                  amount: 500,
                }),
              ]),
            }),
          }),
        ]),
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

      expect(getContacts).toHaveBeenCalledWith(['CONTACT001'])
      expect(generateInkassoSergelFile).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Date)
      )
    })

    it('should return error on missing contacts', async () => {
      getContacts.mockResolvedValueOnce([])

      const result = await enrichOtherInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Contact not found')
        expect(result.error.message).toContain('CONTACT001')
      }
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

      expect(getInvoices).toHaveBeenCalledWith(['INV001'])
      expect(getRentalProperties).toHaveBeenCalledWith(['RENTAL001'])
      expect(generateBalanceCorrectionFile).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Date)
      )
    })

    it('should return error for invoices without rental properties', async () => {
      getRentalProperties.mockResolvedValueOnce([])

      const result = await enrichBalanceCorrections(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Rental property not found')
        expect(result.error.message).toContain('INV001')
      }
    })

    it('should handle balance corrections without invoices', async () => {
      getInvoices.mockResolvedValueOnce([])

      const result = await enrichBalanceCorrections(validCsv)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.file).toBe('mocked-balance-correction-file-content')
      }

      expect(generateBalanceCorrectionFile).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            hasInvoice: false,
          }),
        ]),
        expect.any(Date)
      )
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
    describe('addRoundoffToFirstRow', () => {
      it('should add roundoff to first row amount', () => {
        const rows = [
          createMockRentInvoiceRow({ amount: 1000 }),
          createMockRentInvoiceRow({ amount: 500 }),
        ]

        const result = addRoundoffToFirstRow(rows, 50)

        expect(result[0].amount).toBe(1050)
        expect(result[1].amount).toBe(500)
      })

      it('should return empty array when no rows', () => {
        const result = addRoundoffToFirstRow([], 50)
        expect(result).toEqual([])
      })
    })

    describe('aggregateRows', () => {
      it('should group rows by printGroup', () => {
        const rows = [
          createMockRentInvoiceRow({ printGroup: 'N', amount: 1000 }),
          createMockRentInvoiceRow({ printGroup: 'N', amount: 500 }),
          createMockRentInvoiceRow({ printGroup: 'A', amount: 300 }),
        ]

        const result = aggregateRows(rows)

        expect(result).toHaveLength(2)
        expect(result.find((r) => r.printGroup === 'N')?.amount).toBe(1500)
        expect(result.find((r) => r.printGroup === 'A')?.amount).toBe(300)
      })

      it('should map O to N and E to A', () => {
        const rows = [
          createMockRentInvoiceRow({ printGroup: 'N', amount: 500 }),
          createMockRentInvoiceRow({ printGroup: 'O', amount: 1000 }), // Should be grouped with N
          createMockRentInvoiceRow({ printGroup: 'E', amount: 300 }), // Should be grouped with A
        ]

        const result = aggregateRows(rows)

        expect(result).toHaveLength(2)

        const nGroupRow = result.find((r) => r.printGroup === 'N')
        expect(nGroupRow?.amount).toBe(1500)

        const eGroupRow = result.find((r) => r.printGroup === 'E')
        expect(eGroupRow?.amount).toBe(300)
      })

      it('should sum amount, reduction, and vat', () => {
        const rows = [
          createMockRentInvoiceRow({
            printGroup: 'N',
            amount: 1000,
            reduction: 100,
            vat: 50,
          }),
          createMockRentInvoiceRow({
            printGroup: 'N',
            amount: 500,
            reduction: 50,
            vat: 25,
          }),
        ]

        const result = aggregateRows(rows)

        expect(result[0].amount).toBe(1725)
      })

      it('should prefer Rent/Hyra bostad as main row', () => {
        const rows = [
          createMockRentInvoiceRow({
            printGroup: 'N',
            type: 'Other',
            rentType: 'Other type',
            text: 'Other text',
          }),
          createMockRentInvoiceRow({
            printGroup: 'N',
            type: 'Rent',
            rentType: 'Hyra bostad',
            text: 'Main rent text',
          }),
        ]

        const result = aggregateRows(rows)

        expect(result[0].text).toBe('Main rent text')
        expect(result[0].type).toBe('Rent')
        expect(result[0].rentType).toBe('Hyra bostad')
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
