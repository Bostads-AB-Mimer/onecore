import { z } from 'zod'

export const BuildingTypeSchema = z.object({
  buildingCode: z.string(),
  name: z.string(),
  constructionYear: z.number().nullish(),
  renovationYear: z.number().nullish(),
  valueYear: z.number().nullish(),
  heating: z.string().nullish(),
  fireRating: z.string().nullish(),
  insuranceClass: z.string().nullish(),
  insuranceValue: z.number().nullish(),
})

export const BuildingListSchema = z.array(BuildingTypeSchema)

export type Building = z.infer<typeof BuildingTypeSchema>
export type BuildingList = z.infer<typeof BuildingListSchema>
