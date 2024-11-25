import { z } from 'zod'

export const ComponentTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  manufacturer: z.string().nullable(),
  typeDesignation: z.string().nullable(),
  installationDate: z.date().nullable(),
  warrantyEndDate: z.date().nullable(),
  componentType: z.object({
    componentTypeCode: z.string(),
    name: z.string(),
  }),
  componentCategory: z.object({
    code: z.string(),
    name: z.string(),
  }),
  propertyStructures: z.array(z.object({
    maintenanceUnitByCode: z.object({
      maintenanceUnitId: z.string(),
      maintenanceUnitCode: z.string(),
      name: z.string(),
    }),
  })),
})

export const ComponentListSchema = z.array(ComponentTypeSchema)

export type Component = z.infer<typeof ComponentTypeSchema>
export type ComponentList = z.infer<typeof ComponentListSchema>
