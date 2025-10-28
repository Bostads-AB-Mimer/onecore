import { Invoice, InvoiceTransactionType, PaymentStatus } from '@onecore/types'

const oneDayMs = 24 * 60 * 60 * 1000
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
const sixMonthsMs = 182 * 24 * 60 * 60 * 1000

// Non-problematic invoices
export const mockedInvoices: Invoice[] = [
  {
    amount: 123,
    reference: 'foo',
    debitStatus: 1,
    paymentStatus: PaymentStatus.Paid,
    fromDate: new Date(),
    toDate: new Date(Date.now() + thirtyDaysMs),
    expirationDate: new Date(Date.now() + thirtyDaysMs),
    invoiceDate: new Date(Date.now() + thirtyDaysMs),
    invoiceId: '123456',
    leaseId: '123-456-789/01',
    transactionType: InvoiceTransactionType.Rent,
    transactionTypeName: 'HYRA',
    type: 'Regular',
    source: 'legacy',
    invoiceRows: [],
  },
  {
    amount: 456,
    reference: 'foo',
    debitStatus: 1,
    paymentStatus: PaymentStatus.Paid,
    fromDate: new Date(Date.now() - thirtyDaysMs),
    toDate: new Date(Date.now()),
    expirationDate: new Date(Date.now() - thirtyDaysMs),
    invoiceDate: new Date(Date.now() - thirtyDaysMs),
    invoiceId: '3456711',
    leaseId: '123-456-789/01',
    transactionType: InvoiceTransactionType.Rent,
    transactionTypeName: 'HYRA',
    type: 'Regular',
    source: 'legacy',
    invoiceRows: [],
  },
  {
    amount: 789,
    reference: 'foo',
    debitStatus: 1,
    paymentStatus: PaymentStatus.Unpaid,
    fromDate: new Date(Date.now() - 395 * oneDayMs),
    toDate: new Date(Date.now() - 365 * oneDayMs),
    expirationDate: new Date(Date.now() - 365 * oneDayMs),
    invoiceDate: new Date(Date.now() - 395 * oneDayMs),
    invoiceId: '3456789',
    leaseId: '123-456-789/01',
    transactionType: InvoiceTransactionType.DebtCollection,
    transactionTypeName: 'INKASSOBYRÅ',
    type: 'Regular',
    source: 'legacy',
    invoiceRows: [],
  },
  {
    amount: 456,
    reference: 'foo',
    debitStatus: 1,
    paymentStatus: PaymentStatus.Unpaid,
    fromDate: new Date(Date.now() - thirtyDaysMs),
    toDate: new Date(Date.now()),
    expirationDate: new Date(Date.now() - thirtyDaysMs),
    invoiceDate: new Date(Date.now() - thirtyDaysMs),
    invoiceId: '3456790',
    leaseId: '123-456-789/01',
    transactionType: InvoiceTransactionType.Rent,
    transactionTypeName: 'HYRA',
    type: 'Regular',
    source: 'legacy',
    invoiceRows: [],
  },
]

export const mockedProblematicInvoices: Invoice[] = [
  {
    ...mockedInvoices[0],
    transactionType: InvoiceTransactionType.Reminder,
  },
  {
    ...mockedInvoices[1],
    transactionType: InvoiceTransactionType.DebtCollection,
  },
  {
    ...mockedInvoices[2],
  },
]

export const mockedOldProblematicInvoices: Invoice[] = [
  {
    ...mockedInvoices[0],
    transactionType: InvoiceTransactionType.Reminder,
    expirationDate: new Date(Date.now() - sixMonthsMs - thirtyDaysMs),
  },
  {
    ...mockedInvoices[1],
    transactionType: InvoiceTransactionType.DebtCollection,
    expirationDate: new Date(Date.now() - sixMonthsMs - thirtyDaysMs),
  },
  {
    ...mockedInvoices[2],
  },
]
