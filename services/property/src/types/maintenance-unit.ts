import { z } from 'zod'

export const MaintenanceUnitSchema = z.object({
  id: z.string(),
  rentalPropertyId: z.string().optional(),
  code: z.string(),
  caption: z.string().nullable(),
  type: z.string().nullable(),
  propertyCode: z.string().nullable(),
  propertyName: z.string().nullable(),
})

export type MaintenanceUnit = z.infer<typeof MaintenanceUnitSchema>
