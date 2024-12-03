import { z } from 'zod'

export const PropertyDesignationSchema = z.object({
  propertyDesignationId: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  timestamp: z.string()
})

export const PropertySchema = z.object<z.ZodRawShape>({
  propertyId: z.string(),
  propertyCode: z.string(),
  tract: z.string(),
  propertyDesignation: PropertyDesignationSchema,
  _links: z.object({
    self: z.object({
      href: z.string(),
    }),
  }),
})

export type PropertyDesignation = z.infer<typeof PropertyDesignationSchema>

export type Property = z.infer<typeof PropertySchema>
