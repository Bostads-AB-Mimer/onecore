import { z } from 'zod'

export const UpdateComponentInspectionStateSchema = z.object({
  condition: z.enum(['GOOD', 'FAIR', 'DAMAGED']),
  lastInspectionDate: z.string().datetime(),
})

export type UpdateComponentInspectionState = z.infer<
  typeof UpdateComponentInspectionStateSchema
>
