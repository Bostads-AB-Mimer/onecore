import z from 'zod'

export const GetInvoicesByContactCodeQueryParams = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    remainingAmountGreaterThan: z.coerce.number(),
    skip: z.coerce.number(),
    size: z.coerce.number(),
    after: z.string(),
    hasNextXledgerPage: z
      .enum(['true', 'false'])
      .transform((v) => v.toLowerCase() === 'true'),
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
