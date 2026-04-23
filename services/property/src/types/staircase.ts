import { z } from 'zod'

export const staircasesQueryParamsSchema = z.object({
  buildingCode: z
    .string()
    .min(7, { message: 'buildingCode must be at least 7 characters long.' }),
  staircaseCode: z.string().optional(),
})

export const staircasesSearchQueryParamsSchema = z.object({
  q: z.string().min(3, { message: 'q must be at least 3 characters long.' }),
})

// Identity + features common to every staircase representation. Used directly
// when the staircase is embedded inside another entity (e.g. a residence
// already carries its own building/property at the top level).
export const StaircaseBaseSchema = z.object({
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
  deleted: z.boolean(),
  timestamp: z.string(),
})

// Full staircase entity. By domain rule a real staircase always belongs to
// both a building and a property — the codes/ids are guaranteed non-null and
// the property-service queries enforce it at the `where` clause.
export const StaircaseSchema = StaircaseBaseSchema.extend({
  property: z.object({
    propertyId: z.string(),
    propertyName: z.string().nullable(),
    propertyCode: z.string(),
  }),
  building: z.object({
    buildingId: z.string(),
    buildingName: z.string().nullable(),
    buildingCode: z.string(),
  }),
})

export type Staircase = z.infer<typeof StaircaseSchema>
