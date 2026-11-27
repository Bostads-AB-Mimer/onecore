import { getBosociala, getUnpaidInvoicePaymentSummaries } from '../service'
import { Factory } from 'fishery'

jest.mock('../../../adapters/economy-adapter', () => ({
  getInvoices: jest.fn(),
  getRentInvoiceRows: jest.fn(),
  getLeaseDetailsForInvoices: jest.fn(),
}))

jest.mock('../../../adapters/leasing-adapter', () => ({
  getLeasesBatch: jest.fn(),
  getContacts: jest.fn(),
}))

import {
  getInvoices,
  getRentInvoiceRows,
  getLeaseDetailsForInvoices,
} from '../../../adapters/economy-adapter'
import { getContacts, getLeasesBatch } from '../../../adapters/leasing-adapter'
import { Invoice, RentInvoiceRow } from '@onecore/types'

const xledgerInvoiceFactory = Factory.define<Invoice>(({ sequence }) => ({
  invoiceId: sequence.toString(),
  matchId: sequence,
  leaseIds: ['TEST-LEASE-001'],
  amount: 0,
  paidAmount: 0,
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
  credit: null,
}))

const invoiceRowFactory = Factory.define<RentInvoiceRow>(({ sequence }) => ({
  invoiceNumber: sequence.toString(),
  code: 'HEMFÖR001',
  amount: 0,
  reduction: 0,
  vat: 0,
  rowType: 1,
  text: 'Hemförsäkring',
  type: 'Rent',
  rentType: 'Hyra bostad',
  printGroup: 'A',
  fromDate: new Date(),
  toDate: new Date(),
}))

describe('Report Service', () => {
  const mockGetInvoices = getInvoices as jest.MockedFunction<typeof getInvoices>
  const mockGetInvoiceRows = getRentInvoiceRows as jest.MockedFunction<
    typeof getRentInvoiceRows
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

      mockGetInvoices.mockResolvedValue({ ok: true, data: xledgerInvoices })
      mockGetInvoiceRows.mockResolvedValue({ ok: true, data: invoiceRows })

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        invoiceId: '5500001',
        matchId: 123,
        fractionPaid: 0.5,
        hemforTotal: 8000,
        hemforDebt: 4000,
        hyrsatTotal: 1000,
        hyrsatDebt: 500,
      })
    })

    it('should filter out non-rent invoices', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
        }),
        xledgerInvoiceFactory.build({
          invoiceId: '3300001',
          matchId: 456,
        }),
      ]

      mockGetInvoices.mockResolvedValue({ ok: true, data: xledgerInvoices })
      mockGetInvoiceRows.mockResolvedValue({ ok: true, data: [] })

      await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(mockGetInvoiceRows).toHaveBeenCalledWith(['5500001'])
    })

    it('should handle invoices with no payments', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          amount: 10000,
          paidAmount: 0,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR001',
          amount: 8000,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HYRSÄT001',
          amount: 2000,
        }),
      ]

      mockGetInvoices.mockResolvedValue({ ok: true, data: xledgerInvoices })
      mockGetInvoiceRows.mockResolvedValue({ ok: true, data: invoiceRows })

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        invoiceId: '5500001',
        fractionPaid: 0,
        hemforTotal: 8000,
        hemforDebt: 8000,
        hyrsatTotal: 2000,
        hyrsatDebt: 2000,
      })
    })

    it('should calculate VHK totals correctly for different codes', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          amount: 10000,
          paidAmount: 5000,
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

      mockGetInvoices.mockResolvedValue({ ok: true, data: xledgerInvoices })
      mockGetInvoiceRows.mockResolvedValue({ ok: true, data: invoiceRows })

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result[0]).toEqual(
        expect.objectContaining({
          vhk906Total: 1150,
          vhk933Total: 525,
          vhk934Total: 300,
          vhk936Total: 260,
          vhk906Debt: 575,
          vhk933Debt: 262.5,
          vhk934Debt: 150,
          vhk936Debt: 130,
        })
      )
    })

    it('sums all rows with the same code on an invoice', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          amount: 1000,
          paidAmount: 500,
        }),
      ]

      // Two periods of the same article on one invoice, as Tenfast sends them
      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR',
          amount: 69,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR',
          amount: 69,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HYRSÄT',
          amount: 80,
          vat: 20,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HYRSÄT',
          amount: 80,
          vat: 20,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'VHK906',
          amount: 100,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'VHK906',
          amount: 50,
          reduction: -10,
        }),
      ]

      mockGetInvoices.mockResolvedValue({ ok: true, data: xledgerInvoices })
      mockGetInvoiceRows.mockResolvedValue({ ok: true, data: invoiceRows })

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result[0]).toMatchObject({
        hemforTotal: 138,
        hemforDebt: 69,
        hyrsatTotal: 200,
        hyrsatDebt: 100,
        vhk906Total: 140,
        vhk906Debt: 70,
      })
    })

    it('should handle partial payments correctly', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          amount: 10000,
          paidAmount: 7000,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR001',
          amount: 1000,
        }),
      ]

      mockGetInvoices.mockResolvedValue({ ok: true, data: xledgerInvoices })
      mockGetInvoiceRows.mockResolvedValue({ ok: true, data: invoiceRows })

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        fractionPaid: 0.7,
        hemforDebt: 300,
      })
    })

    it('should skip invoices without relevant invoice rows', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
        }),
        xledgerInvoiceFactory.build({
          invoiceId: '5500002',
          matchId: 456,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          amount: 1000,
          code: 'HYRA',
        }),
      ]

      mockGetInvoices.mockResolvedValue({ ok: true, data: xledgerInvoices })
      mockGetInvoiceRows.mockResolvedValue({ ok: true, data: invoiceRows })

      const result = await getUnpaidInvoicePaymentSummaries(fromDate, toDate)

      expect(result).toHaveLength(0)
    })

    it('should only process invoice rows with specific codes', async () => {
      const xledgerInvoices = [
        xledgerInvoiceFactory.build({
          invoiceId: '5500001',
          matchId: 123,
          amount: 10000,
          paidAmount: 0,
        }),
      ]

      const invoiceRows = [
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HEMFÖR001',
          amount: 1000,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HYRSÄT001',
          amount: 2000,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'VHK906',
          amount: 500,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'HYRA',
          amount: 3000,
        }),
        invoiceRowFactory.build({
          invoiceNumber: '5500001',
          code: 'OTHER',
          amount: 1500,
        }),
      ]

      mockGetInvoices.mockResolvedValue({ ok: true, data: xledgerInvoices })
      mockGetInvoiceRows.mockResolvedValue({ ok: true, data: invoiceRows })

      const result = await getUnpaidInvoicePaymentSummaries()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        hemforTotal: 1000,
        hyrsatTotal: 2000,
        vhk906Total: 500,
        vhk933Total: 0,
        vhk934Total: 0,
        vhk936Total: 0,
        hemforDebt: 1000,
        hyrsatDebt: 2000,
        vhk906Debt: 500,
        vhk933Debt: 0,
        vhk934Debt: 0,
        vhk936Debt: 0,
      })
    })
  })

  describe('getBosociala', () => {
    const mockGetLeaseDetails = getLeaseDetailsForInvoices as jest.Mock

    beforeEach(() => {
      ;(getLeasesBatch as jest.Mock).mockResolvedValue([])
      ;(getContacts as jest.Mock).mockResolvedValue([])
    })

    it("uses the main lease's cost centre, and Xledger's when the lease's isn't known", async () => {
      mockGetInvoices.mockResolvedValue({
        ok: true,
        data: [
          xledgerInvoiceFactory.build({ invoiceId: '1', costCentre: '10000' }),
          xledgerInvoiceFactory.build({ invoiceId: '2', costCentre: '20000' }),
        ],
      })
      mockGetLeaseDetails.mockResolvedValue({
        ok: true,
        data: [
          {
            invoiceId: '1',
            details: [{ leaseId: '216-703-00-0018/01', costCentre: '61110' }],
          },
          {
            invoiceId: '2',
            details: [{ leaseId: '216-703-00-0019/01', costCentre: null }],
          },
        ],
      })

      const result = await getBosociala()

      expect(result.map((i) => i.costCentre)).toEqual(['61110', '20000'])
    })
  })
})
