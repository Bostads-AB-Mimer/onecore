import z from 'zod'

export const SyncCustomerQueryParamsSchema = z.object({
  create: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})
