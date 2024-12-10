import { z } from 'zod'

export const ApplicationProfileHousingReferenceSchema = z.object({
  id: z.number(),
  applicationProfileId: z.number(),
  phone: z.string(),
  email: z.string().nullable(),
  reviewStatus: z.string(),
  reviewStatusReason: z.string().nullable(),
  reviewedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
})
