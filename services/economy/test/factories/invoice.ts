import { Factory } from 'fishery'

import {
  Invoice,
  InvoicePaymentEvent,
  InvoiceRow,
  InvoiceTransactionType,
} from '@onecore/types'

export const InvoiceFactory = Factory.define<Invoice>(() => {
  return {
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
  }
})

export const InvoiceRowFactory = Factory.define<InvoiceRow>(() => ({
  account: '1234567890',
  amount: 100,
  company: '1234567890',
  contactCode: '1234567890',
  deduction: 10,
  freeCode: '1234567890',
  fromDate: '2023-03-01',
  invoiceDate: '2023-02-15',
  invoiceNumber: '1234567890',
  invoiceRowText: '1234567890',
  projectCode: '1234567890',
  rentArticle: '1234567890',
  roundoff: 10,
  tenantName: '1234567890',
  toDate: '2023-03-31',
  totalAmount: 100,
  vat: 10,
  rowType: 1,
  invoiceTotalAmount: 100,
  invoiceDueDate: '2023-03-01',
  printGroup: '1234567890',
  printGroupLabel: '1234567890',
}))

export const InvoicePaymentEventFactory = Factory.define<InvoicePaymentEvent>(
  () => ({
    amount: 100,
    invoiceId: '552303315030452',
    paymentDate: new Date('2023-03-01T00:00:00.000Z'),
    text: null,
    transactionSourceCode: 'foo',
    type: 'OCR',
  })
)
