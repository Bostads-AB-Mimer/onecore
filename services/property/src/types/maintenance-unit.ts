import { z } from 'zod'

export const MaintenanceUnitSchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  rentalPropertyId: z.string().optional(),
  code: z.string(),
  caption: z.string().nullable(),
  type: z.string().nullable(),
  estateCode: z.string().nullable(),
  estate: z.string().nullable(),
})

export type MaintenanceUnit = z.infer<typeof MaintenanceUnitSchema>
