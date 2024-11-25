import { z } from 'zod'
import type { PropertyWithObject, PropertyBasicInfo } from './property-adapter'

// Extend from the adapter type to ensure compatibility
export const PropertyTypeSchema = z.object<z.ZodRawShape>({
  propertyId: z.string(),
  propertyCode: z.string(),
  tract: z.string(),
  propertyDesignation: z.string(),
  _links: z.object({
    self: z.object({
      href: z.string()
    })
  })
})

export const PropertyListSchema = z.array(PropertyTypeSchema)

export type Property = z.infer<typeof PropertyTypeSchema>
export type PropertyList = z.infer<typeof PropertyListSchema>
