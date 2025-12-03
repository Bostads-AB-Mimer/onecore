import z from 'zod'

export const GetInvoicesByContactCodeQueryParams = z
  .object({ from: z.coerce.date().optional() })
  .optional()

export const GetUnpaidInvoicesQueryParams = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})
