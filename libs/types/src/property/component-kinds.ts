import { z } from 'zod'

export const ComponentCategoryTypeSchema = z.enum(['EQUIPMENT', 'SURFACE'])
export type ComponentCategoryType = z.infer<typeof ComponentCategoryTypeSchema>

export const ComponentTypeCodeSchema = z.enum(['WALL', 'FLOOR', 'CEILING'])
export type ComponentTypeCode = z.infer<typeof ComponentTypeCodeSchema>
