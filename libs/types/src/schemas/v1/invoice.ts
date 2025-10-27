import { z } from 'zod'

import { InvoiceTransactionType, PaymentStatus } from '../../enums'

const InvoiceTransactionTypeSchema = z.nativeEnum(InvoiceTransactionType)
const PaymentStatusSchema = z.nativeEnum(PaymentStatus)

export const InvoiceSchema = z.object({
  invoiceId: z.string(),
  leaseId: z.string(),
  amount: z.number(),
  reference: z.string(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  invoiceDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
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
})

export const InvoiceRowSchema = z.object({
  account: z.string(),
  amount: z.number(),
  company: z.string(),
  contactCode: z.string(),
  contractCode: z.string(),
  deduction: z.number(),
  finalPaymentDate: z.coerce.date(),
  freeCode: z.string(),
  fromDate: z.coerce.date(),
  invoiceDate: z.coerce.date(),
  invoiceNumber: z.string(),
  invoiceRowText: z.string(),
  projectCode: z.string(),
  rentArticle: z.string(),
  roundoff: z.number(),
  tenantName: z.string(),
  toDate: z.coerce.date(),
  totalAmount: z.number(),
  vat: z.number(),
  printGroup: z.string(),
  printGroupLabel: z.string().nullable(),
  rowType: z.number(),
})

export const InvoicePaymentEventSchema = z.object({
  type: z.string(),
  invoiceId: z.string(),
  amount: z.number().min(0),
  paymentDate: z.coerce.date(),
  text: z.string().nullable(),
  // TODO: type these when we know what they are
  transactionSourceCode: z.string(),
})
