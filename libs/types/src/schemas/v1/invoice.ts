import { z } from 'zod'

import { InvoiceTransactionType, PaymentStatus } from '../../enums'

const InvoiceTransactionTypeSchema = z.nativeEnum(InvoiceTransactionType)
const PaymentStatusSchema = z.nativeEnum(PaymentStatus)

export const InvoiceRowSchema = z.object({
  account: z.string(),
  amount: z.number(),
  company: z.string(),
  contactCode: z.string(),
  deduction: z.number(),
  freeCode: z.string().nullable(),
  fromDate: z.string(),
  invoiceDate: z.string(),
  invoiceDueDate: z.string(),
  invoiceNumber: z.string(),
  invoiceRowText: z.string().nullable(),
  invoiceTotalAmount: z.number(),
  printGroup: z.string().nullable(),
  printGroupLabel: z.string().nullable(),
  projectCode: z.string().nullable(),
  rentArticle: z.string().nullable(),
  roundoff: z.number(),
  rowType: z.number(),
  tenantName: z.string(),
  toDate: z.string(),
  totalAmount: z.number(),
  vat: z.number(),
})

export const InvoicePaymentEventSchema = z.object({
  type: z.string(),
  invoiceId: z.string(),
  matchId: z.number(),
  amount: z.number().min(0),
  paymentDate: z.coerce.date(),
  text: z.string().nullable(),
  // TODO: type these when we know what they are
  transactionSourceCode: z.string(),
})

export const InvoiceSchema = z.object({
  invoiceId: z.string(),
  leaseId: z.string(),
  amount: z.number(),
  reference: z.string(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  invoiceDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  defermentDate: z.coerce.date().optional(),
  debitStatus: z.number(),
  paymentStatus: PaymentStatusSchema,
  transactionType: InvoiceTransactionTypeSchema,
  transactionTypeName: z.string(),
  paidAmount: z.number().optional(),
  daysSinceLastDebitDate: z.number().optional(),
  description: z.string().optional(),
  sentToDebtCollection: z.coerce.date().optional(),
  type: z.enum(['Regular', 'Other']),
  source: z.enum(['legacy', 'next']),
  invoiceRows: z.array(InvoiceRowSchema),
  invoiceFileUrl: z.string().optional(),
  remainingAmount: z.number().optional(),
})
