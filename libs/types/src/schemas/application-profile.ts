import { z } from 'zod'

import { ApplicationProfileHousingReferenceSchema } from './application-profile-housing-reference'

export const ApplicationProfileSchema = z.object({
  id: z.number(),
  contactCode: z.string(),
  numAdults: z.number(),
  numChildren: z.number(),
  housingType: z.string().optional(),
  housingTypeDescription: z.string().optional(),
  landlord: z.string().optional(),
  housingReference: ApplicationProfileHousingReferenceSchema.optional(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})
