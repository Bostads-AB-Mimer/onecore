import { z } from 'zod'
import { ComponentSubtypeSchema } from './component-subtype'

// ==================== COMPONENT MODELS ====================

// Query params for component models
export const componentModelsQueryParamsSchema = z.object({
  componentTypeId: z.string().uuid().optional(),
  subtypeId: z.string().uuid().optional(),
  manufacturer: z.string().optional(),
  modelName: z.string().optional(), // Search parameter
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Response schema
export const ComponentModelSchema = z.object({
  id: z.string().uuid(),
  modelName: z.string(),
  componentSubtypeId: z.string().uuid(),
  currentPrice: z.number().min(0),
  currentInstallPrice: z.number().min(0),
  warrantyMonths: z.number().int().min(0),
  manufacturer: z.string(),
  technicalSpecification: z.string().nullable(),
  installationInstructions: z.string().nullable(),
  dimensions: z.string().nullable(),
  coclassCode: z.string().nullable(),
  createdAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  updatedAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  subtype: ComponentSubtypeSchema.optional(),
})

// Create schema
export const CreateComponentModelSchema = z.object({
  modelName: z.string().trim().min(1, 'Model name is required'),
  componentSubtypeId: z.string().uuid(),
  currentPrice: z.number().min(0),
  currentInstallPrice: z.number().min(0),
  warrantyMonths: z.number().int().min(0),
  manufacturer: z.string().trim().min(1, 'Manufacturer is required'),
  technicalSpecification: z.string().trim().optional(),
  installationInstructions: z.string().trim().optional(),
  dimensions: z.string().trim().optional(),
  coclassCode: z.string().trim().optional(),
})

// Update schema
export const UpdateComponentModelSchema = z.object({
  modelName: z.string().trim().min(1).optional(),
  componentSubtypeId: z.string().uuid().optional(),
  currentPrice: z.number().min(0).optional(),
  currentInstallPrice: z.number().min(0).optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  manufacturer: z.string().trim().min(1).optional(),
  technicalSpecification: z.string().trim().optional(),
  installationInstructions: z.string().trim().optional(),
  dimensions: z.string().trim().optional(),
  coclassCode: z.string().trim().optional(),
})

export type ComponentModel = z.infer<typeof ComponentModelSchema>
export type CreateComponentModel = z.infer<typeof CreateComponentModelSchema>
export type UpdateComponentModel = z.infer<typeof UpdateComponentModelSchema>

// ==================== FILE AND DOCUMENT SCHEMAS ====================

// Schema for component model documents
export const ComponentModelDocumentSchema = z.object({
  id: z.string().uuid(),
  componentModelId: z.string().uuid(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  uploadedAt: z.string(),
  url: z.string().optional(), // Presigned URL
})

export type ComponentModelDocument = z.infer<
  typeof ComponentModelDocumentSchema
>
