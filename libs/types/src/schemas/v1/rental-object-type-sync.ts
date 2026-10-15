import { z } from 'zod'

export const RentalObjectTypeChangeSchema = z.object({
  rentalObjectCode: z.string(),
  code: z.string().nullable(),
  label: z.string().nullable(),
  timestamp: z.date(),
})

export type RentalObjectTypeChange = z.infer<
  typeof RentalObjectTypeChangeSchema
>
