import { z } from 'zod'
import { ConstructionPartLinksSchema } from './links'

export const constructionPartsQueryParamsSchema = z.object({
  buildingCode: z
    .string()
    .min(7, { message: 'buildingCode must be at least 7 characters long.' }),
})

export const ConstructionPartSchema = z.object({
  id: z.string().trim(),
  propertyObjectId: z.string().trim(),
  constructionPartTypeId: z.string().trim().nullable(),
  code: z.string().trim(),
  name: z.string().trim(),
  constructionYear: z.number().nullable(),
  renovationYear: z.number().nullable(),
  deleteMark: z.number(),
  fromDate: z.date().nullable(),
  toDate: z.date().nullable(),
  timestamp: z.string().trim(),
})

export const ConstructionPartResponseSchema = z.object({
  ...ConstructionPartSchema.shape,
  _links: ConstructionPartLinksSchema,
})
