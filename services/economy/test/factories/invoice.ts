import { Factory } from 'fishery'

import { Invoice, InvoiceRow, InvoiceTransactionType } from '@onecore/types'

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
  }
})

export const InvoiceRowFactory = Factory.define<InvoiceRow>(() => {
  return {
    account: '1234567890',
    amount: 100,
    company: '1234567890',
    contactCode: '1234567890',
    contractCode: '1234567890',
    deduction: 10,
    finalPaymentDate: new Date('2023-03-01T00:00:00.000Z'),
    freeCode: '1234567890',
    fromDate: new Date('2023-03-01T00:00:00.000Z'),
    invoiceDate: new Date('2023-02-15T00:00:00.000Z'),
    invoiceNumber: '1234567890',
    invoiceRowText: '1234567890',
    projectCode: '1234567890',
    rentArticle: '1234567890',
    roundoff: 10,
    tenantName: '1234567890',
    toDate: new Date('2023-03-31T00:00:00.000Z'),
    totalAmount: 100,
    vat: 10,
    printGroup: '1234567890',
    printGroupLabel: '1234567890',
    rowType: 1,
  }
})
