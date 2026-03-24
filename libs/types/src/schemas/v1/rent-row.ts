import z from 'zod'

export const YearMonthDayStringSchema = z.string().brand<'yyyy-mm-dd'>()

export const LeaseRentRowSchema = z.object({
  amount: z.number(),
  articleId: z.string(),
  from: YearMonthDayStringSchema.optional(),
  id: z.string(),
  label: z.string(),
  to: YearMonthDayStringSchema.optional(),
  vat: z.number(),
})
