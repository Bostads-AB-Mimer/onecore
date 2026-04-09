import z from 'zod'
import { PaymentStatus } from '../enums'

export const GetInvoicesByContactCodeQueryParams = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    paymentStatus: z.coerce.number().pipe(z.nativeEnum(PaymentStatus)),
    skip: z.coerce.number(),
    size: z.coerce.number(),
    after: z.string(),
  })
  .partial()

export const GetUnpaidInvoicesQueryParams = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

export const GetInvoicesQueryParams = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    remainingAmountGreaterThan: z.coerce.number().optional(),
    after: z.string().optional(),
    pageSize: z.coerce.number().optional(),
  })
  .optional()
