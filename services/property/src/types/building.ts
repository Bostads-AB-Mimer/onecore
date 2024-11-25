import { z } from 'zod'

export const BuildingTypeSchema = z.object({
  buildingCode: z.string(),
  name: z.string(),
  constructionYear: z.number().nullable(),
  renovationYear: z.number().nullable(),
  valueYear: z.number().nullable(),
  heating: z.string().nullable(),
  fireRating: z.string().nullable(),
  insuranceClass: z.string().nullable(),
  insuranceValue: z.number().nullable(),
})

export const BuildingListSchema = z.array(BuildingTypeSchema)

export type Building = z.infer<typeof BuildingTypeSchema>
export type BuildingList = z.infer<typeof BuildingListSchema>
