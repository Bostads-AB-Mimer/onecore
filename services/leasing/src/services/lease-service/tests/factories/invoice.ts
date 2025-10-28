import { Factory } from 'fishery'
import { Invoice, InvoiceTransactionType } from '@onecore/types'

export const InvoiceFactory = Factory.define<Invoice>(() => ({
  invoiceId: '552303315030452',
  leaseId: '705-025-03-0205/01',
  reference: 'P123456',
  amount: 7687.77,
  fromDate: new Date('2023-03-01T00:00:00.000Z'),
  toDate: new Date('2023-03-31T00:00:00.000Z'),
  invoiceDate: new Date('2023-02-15T00:00:00.000Z'),
  expirationDate: new Date('2023-02-28T00:00:00.000Z'),
  debitStatus: 5,
  paymentStatus: 1,
  transactionType: InvoiceTransactionType.Rent,
  transactionTypeName: 'HYRA',
  type: 'Regular',
  source: 'legacy',
  invoiceRows: [],
}))
