import {
  enrichRentInvoices,
  enrichOtherInvoices,
  enrichBalanceCorrections,
  importInvoicesFromCsv,
  importBalanceCorrectionsFromCsv,
  aggregateRows,
  aggregateXpandRows,
  addRoundoffToFirstRow,
  toInvoiceRow,
  CsvError,
} from '@src/services/debt-collection-service/service'
import { DebtCollectionInvoice } from '@src/services/common/types'

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () =>
  require('./__mocks__/tenfast-adapter')
)

jest.mock('@src/services/common/adapters/xpand-db-adapter', () =>
  require('./__mocks__/xpand-db-adapter')
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
  createMockRentalProperty,
} from './__mocks__/tenfast-adapter'

import {
  getCustomers as getXledgerCustomers,
  setupDefaultMocks as setupXledgerDefaultMocks,
  resetMocks as resetXledgerMocks,
} from './__mocks__/xledger-adapter'

import {
  getContacts as getXpandContacts,
  getInvoices as getXpandInvoices,
  getInvoiceRows as getXpandInvoiceRows,
  getRentalProperties as getXpandRentalProperties,
  setupDefaultMocks as setupXpandDefaultMocks,
  resetMocks as resetXpandMocks,
  createMockXpandContact,
  createMockXpandInvoice,
  createMockXpandInvoiceRow,
  createMockXpandInvoiceRows,
  createMockXpandRentalProperty,
} from './__mocks__/xpand-db-adapter'

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
    setupXpandDefaultMocks()
    ;(generateInkassoSergelFile as jest.Mock).mockClear()
    ;(generateBalanceCorrectionFile as jest.Mock).mockClear()
  })

  afterEach(() => {
    resetMocks()
    resetXledgerMocks()
    resetXpandMocks()
    jest.clearAllMocks()
  })

  // The debtors passed to the mocked file generator
  const getGeneratedInvoices = (): {
    contact: { contactCode: string }
    invoice: DebtCollectionInvoice
  }[] => (generateInkassoSergelFile as jest.Mock).mock.calls[0][0]

  // An Xpand-only invoice: Tenfast doesn't know the invoice or rental property
  const mockXpandOnlyInvoice = () => {
    getInvoiceByOcr.mockResolvedValue({ ok: true, data: null })
    getRentalProperty.mockResolvedValue({ ok: true, data: null })
    getXpandInvoices.mockResolvedValue([createMockXpandInvoice()])
    getXpandInvoiceRows.mockResolvedValue(createMockXpandInvoiceRows())
    getXpandRentalProperties.mockResolvedValue([
      createMockXpandRentalProperty(),
    ])
  }

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

    it('falls back to Xpand for a contact Tenfast does not have', async () => {
      getContactByContactCode.mockResolvedValue({ ok: true, data: null })
      getXpandContacts.mockResolvedValue([
        createMockXpandContact({ contactCode: 'CONTACT001' }),
      ])

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(true)
      expect(getXpandContacts).toHaveBeenCalledWith(['CONTACT001'])
      expect(getGeneratedInvoices()[0].contact).toEqual(
        expect.objectContaining({ fullName: 'Jane Doe' })
      )
    })

    it('does not ask Xpand for contacts Tenfast has', async () => {
      await enrichRentInvoices(validCsv)

      expect(getXpandContacts).toHaveBeenCalledWith([])
    })

    it('builds an invoice from Xpand when Tenfast does not have it', async () => {
      mockXpandOnlyInvoice()
      const csv = createRentInvoiceCsv([
        {
          ...sampleRentInvoiceData,
          invoiceNumber: 'XINV001',
          totalAmount: '4625',
          remainingAmount: '4625',
        },
      ])

      const result = await enrichRentInvoices(csv)

      expect(result.ok).toBe(true)
      expect(getXpandInvoices).toHaveBeenCalledWith(['XINV001'])
      expect(getXpandRentalProperties).toHaveBeenCalledWith(['XPA-NDR-00-2002'])

      const { invoice } = getGeneratedInvoices()[0]
      expect(invoice.invoiceNumber).toBe('XINV001')
      expect(invoice.reference).toBe('XPA-NDR-00-2002/01')
      expect(invoice.lastDebitDate).toEqual(new Date('2023-06-30'))
      expect(invoice.rentalProperties[0].rentalPropertyId).toBe(
        'XPA-NDR-00-2002'
      )
      // Hyra bostad 4000 + Värme 500 + VAT 125, grouped under the header
      expect(invoice.rows).toHaveLength(1)
      expect(invoice.rows[0].invoiceRowText).toBe('Hyra bostad')
      expect(invoice.amount).toBe(4625)
    })

    it('adds the Xpand roundoff to the first row', async () => {
      mockXpandOnlyInvoice()
      getXpandInvoices.mockResolvedValue([
        createMockXpandInvoice({ roundoff: 0.4 }),
      ])
      const csv = createRentInvoiceCsv([
        {
          ...sampleRentInvoiceData,
          invoiceNumber: 'XINV001',
          totalAmount: '4625.4',
          remainingAmount: '4625.4',
        },
      ])

      await enrichRentInvoices(csv)

      expect(getGeneratedInvoices()[0].invoice.amount).toBeCloseTo(4625.4)
    })

    it('handles a CSV with both Tenfast and Xpand invoices', async () => {
      getInvoiceByOcr.mockImplementation(async (ocr: string) => ({
        ok: true,
        data: ocr === 'INV001' ? { invoice: createMockRentInvoice() } : null,
      }))
      getXpandInvoices.mockResolvedValue([createMockXpandInvoice()])
      getXpandInvoiceRows.mockResolvedValue(createMockXpandInvoiceRows())
      getRentalProperty.mockImplementation(async (id: string) => ({
        ok: true,
        data: id === 'REN-TAL-00-1001' ? createMockRentalProperty() : null,
      }))
      getXpandRentalProperties.mockResolvedValue([
        createMockXpandRentalProperty(),
      ])
      const csv = createRentInvoiceCsv([
        sampleRentInvoiceData,
        { ...sampleRentInvoiceData, invoiceNumber: 'XINV001' },
      ])

      const result = await enrichRentInvoices(csv)

      expect(result.ok).toBe(true)
      expect(getXpandInvoices).toHaveBeenCalledWith(['XINV001'])
      expect(getXpandRentalProperties).toHaveBeenCalledWith(['XPA-NDR-00-2002'])
      expect(
        getGeneratedInvoices().map(({ invoice }) => [
          invoice.invoiceNumber,
          invoice.rentalProperties[0].rentalPropertyId,
        ])
      ).toEqual([
        ['INV001', 'REN-TAL-00-1001'],
        ['XINV001', 'XPA-NDR-00-2002'],
      ])
    })

    it('falls back to Xpand for the rental property of a Tenfast invoice', async () => {
      getRentalProperty.mockResolvedValue({ ok: true, data: null })
      getXpandRentalProperties.mockResolvedValue([
        createMockXpandRentalProperty({ rentalPropertyId: 'REN-TAL-00-1001' }),
      ])

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(true)
      expect(getXpandRentalProperties).toHaveBeenCalledWith(['REN-TAL-00-1001'])
    })

    it('uses the rental id in the lease id when Tenfast lacks the lease', async () => {
      getLease.mockResolvedValue({ ok: true, data: null })

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(true)
      expect(getRentalProperty).toHaveBeenCalledWith('REN-TAL-00-1001')
      expect(getGeneratedInvoices()[0].invoice.lastDebitDate).toBeUndefined()
    })

    it('fails without asking Xpand when a Tenfast lookup fails', async () => {
      getInvoiceByOcr.mockResolvedValueOnce({ ok: false, err: 'unknown' })

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
      expect(getXpandInvoices).not.toHaveBeenCalled()
    })

    it('returns an error when neither Tenfast nor Xpand has the invoice', async () => {
      getInvoiceByOcr.mockResolvedValue({ ok: true, data: null })

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain(
          "Invoice not found for invoice number 'INV001'"
        )
      }
    })

    it('returns an error when no source has the rental property', async () => {
      getRentalProperty.mockResolvedValue({ ok: true, data: null })

      const result = await enrichRentInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Rental properties not found for invoice INV001'
        )
      }
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

    it('falls back to Xpand for a contact Tenfast does not have', async () => {
      getContactByContactCode.mockResolvedValue({ ok: true, data: null })
      getXpandContacts.mockResolvedValue([
        createMockXpandContact({ contactCode: 'CONTACT001' }),
      ])

      const result = await enrichOtherInvoices(validCsv)

      expect(result.ok).toBe(true)
      expect(getGeneratedInvoices()[0].contact).toEqual(
        expect.objectContaining({ fullName: 'Jane Doe' })
      )
    })

    it('returns an error when no source has the contact', async () => {
      getContactByContactCode.mockResolvedValue({ ok: true, data: null })
      getXledgerCustomers.mockResolvedValueOnce([])

      const result = await enrichOtherInvoices(validCsv)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain(
          "Contact not found for contact code 'CONTACT001'"
        )
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

    it('uses an Xpand invoice when Tenfast does not have it', async () => {
      mockXpandOnlyInvoice()
      const csv = createBalanceCorrectionCsv([
        { ...sampleBalanceCorrectionData, invoiceNumber: 'XINV001' },
      ])

      const result = await enrichBalanceCorrections(csv)

      expect(result.ok).toBe(true)
      const [correction] = (generateBalanceCorrectionFile as jest.Mock).mock
        .calls[0][0]
      expect(correction).toEqual(
        expect.objectContaining({
          hasInvoice: true,
          reference: 'XPA-NDR-00-2002/01',
          lastDebitDate: new Date('2023-06-30'),
          rentalProperty: expect.objectContaining({
            rentalPropertyId: 'XPA-NDR-00-2002',
          }),
        })
      )
    })

    it('marks the correction as without invoice when no source has it', async () => {
      getInvoiceByOcr.mockResolvedValue({ ok: true, data: null })

      const result = await enrichBalanceCorrections(validCsv)

      expect(result.ok).toBe(true)
      const [correction] = (generateBalanceCorrectionFile as jest.Mock).mock
        .calls[0][0]
      expect(correction.hasInvoice).toBe(false)
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

    describe('aggregateXpandRows', () => {
      it('groups the rows after a header row and sums reduction and vat', () => {
        const result = aggregateXpandRows(createMockXpandInvoiceRows())

        expect(result).toHaveLength(1)
        expect(result[0].text).toBe('Hyra bostad')
        expect(result[0].amount).toBe(4625)
      })

      it('ends a group at a new print group', () => {
        const result = aggregateXpandRows([
          ...createMockXpandInvoiceRows(),
          createMockXpandInvoiceRow({
            text: 'Påminnelseavgift',
            printGroup: null,
            amount: 60,
          }),
        ])

        expect(result.map((r) => r.amount)).toEqual([4625, 60])
      })

      it('keeps rows without a header as they are', () => {
        const rows = [
          createMockXpandInvoiceRow({ printGroup: 'N', amount: 100 }),
          createMockXpandInvoiceRow({ printGroup: 'N', amount: 200 }),
        ]

        expect(aggregateXpandRows(rows).map((r) => r.amount)).toEqual([
          100, 200,
        ])
      })

      it('ignores a header row at the end', () => {
        const [header] = createMockXpandInvoiceRows()

        expect(aggregateXpandRows([header])).toEqual([])
      })

      it('throws when a header row does not start with a lease id', () => {
        expect(() =>
          aggregateXpandRows([
            createMockXpandInvoiceRow({ rowType: 3, text: 'Not a lease' }),
          ])
        ).toThrow('does not match regular expression for lease ids')
      })
    })

    describe('addRoundoffToFirstRow', () => {
      it('adds the roundoff to the first row only', () => {
        const rows = [
          createMockXpandInvoiceRow({ amount: 100 }),
          createMockXpandInvoiceRow({ amount: 200 }),
        ]

        expect(addRoundoffToFirstRow(rows, -0.5).map((r) => r.amount)).toEqual([
          99.5, 200,
        ])
      })

      it('returns no rows for no rows', () => {
        expect(addRoundoffToFirstRow([], 1)).toEqual([])
      })
    })

    describe('toInvoiceRow', () => {
      it('maps text and amount, with reduction and vat already included', () => {
        const result = toInvoiceRow(
          createMockXpandInvoiceRow({
            text: 'Hyra bostad',
            amount: 4625,
            code: 'HYRA',
          })
        )

        expect(result).toEqual(
          expect.objectContaining({
            invoiceNumber: 'XINV001',
            invoiceRowText: 'Hyra bostad',
            amount: 4625,
            totalAmount: 4625,
            deduction: 0,
            vat: 0,
            rentArticle: 'HYRA',
          })
        )
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
