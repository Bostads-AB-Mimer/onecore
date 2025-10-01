import { z } from 'zod'

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
})
