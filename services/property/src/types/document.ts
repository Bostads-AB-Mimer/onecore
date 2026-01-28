import { z } from 'zod'

// ==================== DOCUMENTS ====================

// Response schema - base document
export const DocumentSchema = z.object({
  id: z.string().uuid(),
  componentModelId: z.string().uuid().nullable(),
  componentInstanceId: z.string().uuid().nullable(),
  fileId: z.string(),
  createdAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  updatedAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
})

// Response schema - document with presigned URL and metadata
export const DocumentWithUrlSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val)),
  url: z.string().url(),
})

export type Document = z.infer<typeof DocumentSchema>
export type DocumentWithUrl = z.infer<typeof DocumentWithUrlSchema>
