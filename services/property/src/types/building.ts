import { z } from 'zod'

export const BuildingSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  buildingType: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
  }),
  construction: z.object({
    constructionYear: z.number().nullable(),
    renovationYear: z.number().nullable(),
    valueYear: z.number().nullable(),
  }),
  features: z.object({
    heating: z.string().nullable(),
    fireRating: z.string().nullable(),
  }),
  insurance: z.object({
    class: z.string().nullable(),
    value: z.number().nullable(),
  }),
  deleted: z.boolean(),
})

export type Building = z.infer<typeof BuildingSchema>
