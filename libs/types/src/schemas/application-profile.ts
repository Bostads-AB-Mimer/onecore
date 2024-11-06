import { z } from 'zod'

export const ApplicationProfileSchema = z.object({
  id: z.number(),
  contactCode: z.string(),
  numAdults: z.number(),
  numChildren: z.number(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})
