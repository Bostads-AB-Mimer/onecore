import { z } from 'zod'

export const MaintenanceUnitSchema = z.object({
  id: z.string(),
  rentalPropertyId: z.string().optional(),
  code: z.string(),
  caption: z.string().nullable(),
  type: z.string().nullable(),
  property: z.object({
    id: z.string().nullable(),
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
  building: z.object({
    id: z.string().nullable(),
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
})

export type MaintenanceUnit = z.infer<typeof MaintenanceUnitSchema>
