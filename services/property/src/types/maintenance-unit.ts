import { z } from 'zod'

export const MaintenanceUnitSchema = z.object({
  id: z.string(),
  rentalPropertyId: z.string(),
  code: z.string(),
  caption: z.string(),
  type: z.string(),
  estateCode: z.string(),
  estate: z.string(),
})

export type MaintenanceUnitInfo = z.infer<typeof MaintenanceUnitSchema>
