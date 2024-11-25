import { z } from 'zod'

export const PropertyTypeSchema = z.object({
  propertyId: z.string(),
  propertyCode: z.string(),
  tract: z.string(),
  propertyDesignation: z.string(),
})

export const PropertyListSchema = z.array(PropertyTypeSchema)

export type Property = z.infer<typeof PropertyTypeSchema>
export type PropertyList = z.infer<typeof PropertyListSchema>
