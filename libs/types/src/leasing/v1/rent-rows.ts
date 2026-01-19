import z from 'zod'

export const CreateLeaseRentRowRequestBodySchema = z.object({
  amount: z.number(),
  articleId: z.string(),
  label: z.string(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})
