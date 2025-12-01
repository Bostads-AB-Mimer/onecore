import { z } from 'zod'

export const staircasesQueryParamsSchema = z.object({
  buildingCode: z
    .string()
    .min(7, { message: 'buildingCode must be at least 7 characters long.' }),
})

export const StaircaseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  features: z.object({
    floorPlan: z.string().nullable(),
    accessibleByElevator: z.boolean(),
  }),
  dates: z.object({
    from: z.date(),
    to: z.date(),
  }),
  property: z
    .object({
      propertyId: z.string().nullable(),
      propertyName: z.string().nullable(),
      propertyCode: z.string().nullable(),
    })
    .optional(),
  building: z
    .object({
      buildingId: z.string().nullable(),
      buildingName: z.string().nullable(),
      buildingCode: z.string().nullable(),
    })
    .optional(),
  deleted: z.boolean(),
  timestamp: z.string(),
})

export type Staircase = z.infer<typeof StaircaseSchema>
