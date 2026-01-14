import z from 'zod'

export const RentArticleSchema = z.object({
  id: z.string(),
  hyresvard: z.string(),
  title: z.string(),
  defaultLabel: z.string(),
  code: z.string(),
  accountNr: z.string().nullable().optional(),
  vat: z.number().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  includeInContract: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable().optional(),
})
