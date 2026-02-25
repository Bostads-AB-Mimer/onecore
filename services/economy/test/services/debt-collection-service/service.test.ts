import {
  enrichRentInvoices,
  enrichOtherInvoices,
  enrichBalanceCorrections,
  importInvoicesFromCsv,
  importBalanceCorrectionsFromCsv,
  addRoundoffToFirstRow,
  aggregateRows,
  CsvError,
} from '@src/services/debt-collection-service/service'

// Mock the database adapters
jest.mock('@src/services/common/adapters/xpand-db-adapter', () =>
  require('./__mocks__/xpand-db-adapter')
)

jest.mock('@src/services/common/adapters/xledger-adapter', () =>
  require('./__mocks__/xledger-adapter')
)

// Mock the file generators
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
  getContacts,
  getInvoices,
  getRentalProperties,
  getInvoiceRows,
  setupDefaultMocks,
  resetMocks,
  createMockRentInvoiceRow,
  createMockRentalProperty,
} from './__mocks__/xpand-db-adapter'

import {
  getContacts as getXledgerContacts,
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

      // Verify database calls were made with correct parameters
      expect(getContacts).toHaveBeenCalledWith(['CONTACT001'])
      expect(getInvoices).toHaveBeenCalledWith(['INV001'])
      expect(getInvoiceRows).toHaveBeenCalledWith(['INV001'])
      expect(getRentalProperties).toHaveBeenCalledWith(['REN-TAL-00-1001'])

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
        expect(result.error.message).toContain('Rental properties not found')
        expect(result.error.message).toContain('INV001')
      }
    })

    it('should aggregate invoice rows correctly', async () => {
      const rows = [
        // Header row with lease ID
        createMockRentInvoiceRow({
          rowType: 3,
          text: 'ABC-DEF-GH-IJKL/01',
          printGroup: null,
        }),
        // First group of rows with printGroup 'N'
        createMockRentInvoiceRow({ printGroup: 'N', amount: 1000 }),
        createMockRentInvoiceRow({
          printGroup: 'N',
          amount: 0,
          reduction: 100,
        }),
        // Another header row
        createMockRentInvoiceRow({
          rowType: 3,
          text: 'XYZ-ABC-DE-FGHI/02',
          printGroup: null,
        }),
        // Second group with printGroup 'A'
        createMockRentInvoiceRow({ printGroup: 'A', amount: 100 }),
        createMockRentInvoiceRow({ printGroup: 'A', amount: 200 }),
        // Row with null printGroup (ungrouped)
        createMockRentInvoiceRow({ printGroup: null, amount: 300 }),
      ]

      const aggregated = aggregateRows(rows)

      expect(aggregated).toHaveLength(3)

      // First group should sum amount + reduction
      expect(aggregated[0].amount).toBe(1100) // 1000 + 0 + 100
      expect(aggregated[0].printGroup).toBe('N')

      // Second group
      expect(aggregated[1].amount).toBe(300) // 100 + 200
      expect(aggregated[1].printGroup).toBe('A')

      // Ungrouped row
      expect(aggregated[2].amount).toBe(300)
      expect(aggregated[2].printGroup).toBe(null)
    })

    it('should handle partially paid invoices correctly', async () => {
      const mockRows = [
        // Header row for first lease - use the same rental ID as the mock
        createMockRentInvoiceRow({
          rowType: 3,
          text: 'REN-TAL-00-1001/01',
          printGroup: null,
        }),
        createMockRentInvoiceRow({
          rentType: 'Hyra bostad',
          amount: 5000,
          type: 'Rent',
          printGroup: 'A',
          text: 'Hyra bostad',
        }),
        createMockRentInvoiceRow({
          rentType: 'Hyra bostad',
          amount: 0,
          reduction: -500,
          type: 'Rent',
          printGroup: 'A',
          text: 'Reduction',
        }),
      ]

      // Mock additional rental properties for other potential lease IDs
      getRentalProperties.mockResolvedValueOnce([
        createMockRentalProperty({ rentalId: 'REN-TAL-00-1001' }),
      ])

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

      expect(getContacts).toHaveBeenCalledWith(['CONTACT001'])
      expect(generateInkassoSergelFile).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Date)
      )
    })

    it('should return error on missing contacts', async () => {
      getContacts.mockResolvedValueOnce([])
      getXledgerContacts.mockResolvedValueOnce([])

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
      expect(getRentalProperties).toHaveBeenCalledWith(['REN-TAL-00-1001'])
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
        expect(result.error.message).toContain('Rental properties not found')
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
      it('should group rows by header and printGroup sequences', () => {
        const rows = [
          // Header row
          createMockRentInvoiceRow({
            rowType: 3,
            text: 'ABC-DEF-GH-IJKL/01',
            printGroup: null,
          }),
          // Group with printGroup 'N'
          createMockRentInvoiceRow({ printGroup: 'N', amount: 1000 }),
          createMockRentInvoiceRow({ printGroup: 'N', amount: 500 }),
          // Another header row
          createMockRentInvoiceRow({
            rowType: 3,
            text: 'XYZ-ABC-DE-FGHI/02',
            printGroup: null,
          }),
          // Group with printGroup 'A'
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

      it('should sum amount, reduction, and vat for grouped rows', () => {
        const rows = [
          // Header row
          createMockRentInvoiceRow({
            rowType: 3,
            text: 'ABC-DEF-GH-IJKL/01',
            printGroup: null,
          }),
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
        expect(result).toHaveLength(1)
        expect(result[0].amount).toBe(1725) // 1000 + 500 + 100 + 50 + 50 + 25
      })

      it('should prefer Hyra bostad or Hyra p-plats as main row', () => {
        const rows = [
          // Header row
          createMockRentInvoiceRow({
            rowType: 3,
            text: 'ABC-DEF-GH-IJKL/01',
            printGroup: null,
          }),
          createMockRentInvoiceRow({
            printGroup: 'N',
            type: 'Other',
            text: 'Other text',
          }),
          createMockRentInvoiceRow({
            printGroup: 'N',
            type: 'Rent',
            text: 'Hyra bostad',
          }),
        ]
        const result = aggregateRows(rows)
        expect(result).toHaveLength(1)
        expect(result[0].text).toBe('Hyra bostad')
        expect(result[0].type).toBe('Rent')
      })

      it('should handle invalid header row format by throwing error', () => {
        const rows = [
          // Invalid header row format
          createMockRentInvoiceRow({
            rowType: 3,
            text: 'INVALID-FORMAT',
            printGroup: null,
          }),
        ]
        expect(() => aggregateRows(rows)).toThrow(
          'INVALID-FORMAT does not match regular expression for lease ids'
        )
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
