import { z } from 'zod'

export const XpandInspectionSchema = z.object({
  id: z.string(),
  status: z.string(),
  date: z.coerce.date(),
  inspector: z.string(),
  type: z.string(),
  address: z.string(),
  apartmentCode: z.string(),
  leaseId: z.string(),
  masterKeyAccess: z.string().nullable(),
})

export const GetInspectionsFromXpandQuerySchema = z.object({
  skip: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortAscending: z
    .string()
    .transform((s) => (s === 'true' ? true : false))
    .optional(),
})

export type XpandInspection = z.infer<typeof XpandInspectionSchema>
