import z from 'zod'

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

export const XledgerDeferralRequestSchema = z.object({
  endDate: z.string().regex(isoDateRegex, 'endDate must be YYYY-MM-DD'),
})

export const DeferralRequestSchema = z.object({
  endDate: z.string().regex(isoDateRegex, 'endDate must be YYYY-MM-DD'),
  reason: z.string().optional(),
})

export const TenfastGracePeriodRequestSchema = z.object({
  endDate: z.string().regex(isoDateRegex, 'endDate must be YYYY-MM-DD'),
  madeByEmail: z.string().email(),
  reason: z.string().optional(),
})

export const GetInvoicesByContactCodeQueryParams = z
  .object({ from: z.coerce.date().optional() })
  .optional()

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
