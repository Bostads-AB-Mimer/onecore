import z from 'zod'

export const GetInvoicesByContactCodeQueryParams = z
  .object({ from: z.coerce.date().optional() })
  .optional()

export const GetUnpaidInvoicesQueryParams = z
  .object({
    offset: z.coerce.number().optional(),
    size: z.coerce.number().optional(),
  })
  .optional()
