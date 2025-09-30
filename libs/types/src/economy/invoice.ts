import z from 'zod'

export const GetInvoicesByContactCodeQueryParams = z
  .object({ from: z.coerce.date().optional() })
  .optional()
