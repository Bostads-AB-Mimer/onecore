import { getUnpaidInvoicePaymentSummaries } from '@src/services/report-service/service'
import { InvoicePaymentEvent } from '@onecore/types'
import { RentInvoiceRow } from '@src/services/common/types'
import { InvoiceWithMatchId } from '@src/services/report-service/types'

jest.mock('@src/services/common/adapters/xledger-adapter', () => ({
  getAllInvoicePaymentEvents: jest.fn(),
  getAllInvoicesWithMatchIds: jest.fn(),
}))

jest.mock('@src/services/common/adapters/xpand-db-adapter', () => ({
  getInvoiceRows: jest.fn(),
}))

import {
  getAllInvoicePaymentEvents,
  getAllInvoicesWithMatchIds,
} from '@src/services/common/adapters/xledger-adapter'
import { getInvoiceRows } from '@src/services/common/adapters/xpand-db-adapter'
import { Factory } from 'fishery'

const xledgerInvoiceFactory = Factory.define<InvoiceWithMatchId>(
  ({ sequence }) => ({
    invoiceId: '5500001',
    matchId: sequence,
    leaseId: 'TEST-LEASE-001',
    amount: 10000,
    paidAmount: 5000,
    reference: 'REF123',
    fromDate: new Date('2025-01-01'),
    toDate: new Date('2025-01-31'),
    invoiceDate: new Date('2025-01-15'),
    expirationDate: new Date('2025-02-15'),
    debitStatus: 1,
    paymentStatus: 1,
    transactionType: 1,
    transactionTypeName: 'HYRA',
    type: 'Regular',
    source: 'legacy',
    invoiceRows: [],
  })
)

const paymentEventFactory = Factory.define<InvoicePaymentEvent>(
  ({ sequence }) => ({
    type: 'OCR',
    invoiceId: '5500001',
    matchId: sequence,
    paymentDate: new Date('2025-01-15'),
    amount: -5000,
    text: null,
    transactionSourceCode: 'OCR',
  })
)

const invoiceRowFactory = Factory.define<RentInvoiceRow>(({ sequence }) => ({
  invoiceNumber: sequence.toString(),
  code: 'HEMFÖR001',
  amount: 8000,
  reduction: 0,
  vat: 0,
  rowType: 1,
  text: 'Hemförsäkring',
  type: 'Rent',
  rentType: 'Hyra bostad',
  printGroup: 'A',
}))

describe('Report Service', () => {
  const mockGetAllInvoicesWithMatchIds =
    getAllInvoicesWithMatchIds as jest.MockedFunction<
      typeof getAllInvoicesWithMatchIds
    >
  const mockGetAllInvoicePaymentEvents =
    getAllInvoicePaymentEvents as jest.MockedFunction<
      typeof getAllInvoicePaymentEvents
    >
  const mockGetInvoiceRows = getInvoiceRows as jest.MockedFunction<
    typeof getInvoiceRows
  >

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getInvoicePaymentSummaries', () => {
    const fromDate = new Date('2025-01-01')
    const toDate = new Date('2025-01-31')

    it('should process rent invoices and return payment summaries', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          amount: 10000,
          paidAmount: 5000,
        }),
      ]

      const paymentEvents = [
        paymentEventFactory.build({
          matchId: 123,
          paymentDate: new Date('2025-01-15T00:00:00.000Z'),
          amount: -5000,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR001',
          amount: 8000,
          reduction: 0,
          vat: 0,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HYRSÄT001',
          amount: 1000,
          reduction: 0,
          vat: 0,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HYRA',
          amount: 1000,
          reduction: 0,
          vat: 0,
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue(paymentEvents)
      mockGetInvoiceRows.mockResolvedValue(invoiceRows)

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        invoiceId: '5500001',
        matchId: 123,
        paymentDate: new Date('2025-01-15T00:00:00.000Z'),
        amountPaid: 5000,
        fractionPaid: 0.5,
        hemforTotal: 8000,
        hemforPaid: 4000,
        hyrsatTotal: 1000,
        hyrsatPaid: 500,
      })
    })

    it('should filter out non-rent invoices', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '3300001',
          matchId: 456,
          paidAmount: 1000,
        }),
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          paidAmount: 2000,
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue([])
      mockGetInvoiceRows.mockResolvedValue([])

      await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(mockGetAllInvoicePaymentEvents).toHaveBeenCalledWith([123])
      expect(mockGetInvoiceRows).toHaveBeenCalledWith(['5500001'])
    })

    it('should filter out unpaid invoices', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 100,
          paidAmount: 0,
        }),
        xledgerInvoiceFactory.build({
          invoiceId: '5500002',
          matchId: 200,
          paidAmount: 0,
        }),
        xledgerInvoiceFactory.build({
          invoiceId: '5500003',
          matchId: 300,
          paidAmount: 1000,
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue([])
      mockGetInvoiceRows.mockResolvedValue([])

      await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(mockGetInvoiceRows).toHaveBeenCalledWith(['5500003'])
    })

    it('should filter payment events by date range', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          paidAmount: 3000,
        }),
      ]

      const paymentEvents = [
        paymentEventFactory.build({
          matchId: 123,
          paymentDate: new Date('2024-12-15T00:00:00.000Z'),
          amount: -1000,
        }),
        paymentEventFactory.build({
          matchId: 123,
          paymentDate: new Date('2025-01-15T00:00:00.000Z'),
          amount: -2000,
        }),
        paymentEventFactory.build({
          matchId: 123,
          paymentDate: new Date('2025-02-15T00:00:00.000Z'),
          amount: -1000,
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue(paymentEvents)
      mockGetInvoiceRows.mockResolvedValue([
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR001',
          amount: 1000,
        }),
      ])

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(1)
      expect(result[0].amountPaid).toBe(2000)
    })

    it('should filter out credit events (positive amounts)', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          paidAmount: 1000,
        }),
      ]

      const paymentEvents = [
        paymentEventFactory.build({
          matchId: 123,
          amount: 1000, // Credit
        }),
        paymentEventFactory.build({
          matchId: 123,
          amount: -1000, // Payment
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue(paymentEvents)
      mockGetInvoiceRows.mockResolvedValue([
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR001',
          amount: 1000,
        }),
      ])

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(1)
      expect(result[0].amountPaid).toBe(1000)
    })

    it('should calculate VHK totals correctly for different codes', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          paidAmount: 5000,
        }),
      ]

      const paymentEvents = [
        paymentEventFactory.build({
          matchId: 123,
          amount: -5000,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'VHK906',
          amount: 1000,
          reduction: 100,
          vat: 50,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'VHK933',
          amount: 500,
          reduction: 0,
          vat: 25,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'VHK934',
          amount: 300,
          reduction: 0,
          vat: 0,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'VHK936',
          amount: 200,
          reduction: 50,
          vat: 10,
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue(paymentEvents)
      mockGetInvoiceRows.mockResolvedValue(invoiceRows)

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result[0]).toEqual(
        expect.objectContaining({
          vhk906Total: 1150,
          vhk933Total: 525,
          vhk934Total: 300,
          vhk936Total: 260,
        })
      )
    })

    it('should handle multiple payment events for same invoice', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          amount: 10000,
          paidAmount: 7000,
        }),
      ]

      const paymentEvents = [
        paymentEventFactory.build({
          matchId: 123,
          paymentDate: new Date('2025-01-10T00:00:00.000Z'),
          amount: -3000,
        }),
        paymentEventFactory.build({
          matchId: 123,
          paymentDate: new Date('2025-01-20T00:00:00.000Z'),
          amount: -4000,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR001',
          amount: 10000,
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue(paymentEvents)
      mockGetInvoiceRows.mockResolvedValue(invoiceRows)

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        amountPaid: 3000,
        fractionPaid: 0.3,
        hemforPaid: 3000,
      })
      expect(result[1]).toMatchObject({
        amountPaid: 4000,
        fractionPaid: 0.4,
        hemforPaid: 4000,
      })
    })

    it('should handle overpayment by capping fraction at 1', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          amount: 5000,
          paidAmount: 6000,
        }),
      ]

      const paymentEvents = [
        paymentEventFactory.build({
          matchId: 123,
          amount: -6000,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR001',
          amount: 5000,
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue(paymentEvents)
      mockGetInvoiceRows.mockResolvedValue(invoiceRows)

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result[0].fractionPaid).toBe(1)
      expect(result[0].hemforPaid).toBe(5000)
    })

    it('should skip invoices without relevant invoice rows', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          paidAmount: 1000,
        }),
      ]

      const paymentEvents = [
        paymentEventFactory.build({
          matchId: 123,
          amount: -1000,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          amount: 1000,
          code: 'HYRA',
        }),
      ]

      mockGetAllInvoicesWithMatchIds.mockResolvedValue(xledgerInvoices)
      mockGetAllInvoicePaymentEvents.mockResolvedValue(paymentEvents)
      mockGetInvoiceRows.mockResolvedValue(invoiceRows)

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(0)
    })
  })
})
