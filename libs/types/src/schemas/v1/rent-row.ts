import z from 'zod'

export const YearMonthStringSchema = z.string().brand<'yyyy-mm'>()

export const RentRowSchema = z.object({
  amount: z.number(),
  articleId: z.string(),
  from: YearMonthStringSchema.optional(),
  id: z.string(),
  label: z.string(),
  to: YearMonthStringSchema.optional(),
  vat: z.number(),
})
