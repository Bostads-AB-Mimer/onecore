import { z } from 'zod'
import { property } from '@onecore/types'

// ==================== AI COMPONENT ANALYSIS ====================

// Re-exported from @onecore/types (single source of truth shared with the
// core proxy). Keep the local export names so the route, the berget adapter
// and the swagger registration are unaffected.
export const AnalyzeComponentImageRequestSchema =
  property.AnalyzeComponentImageRequestSchema
export const AIComponentAnalysisSchema = property.AIComponentAnalysisSchema

export type AnalyzeComponentImageRequest = property.AnalyzeComponentImageRequest
export type AIComponentAnalysis = property.AIComponentAnalysis

// ==================== AI SCANNER ANALYSIS ====================

// Request schema for scanner app AI analysis
export const AnalyzeScannerImageRequestSchema = z.object({
  imageBase64: z.string().min(1, 'Image base64 is required'),
  feedback: z.string().optional(),
  isTypePlate: z.boolean().optional().default(false),
})

export type AnalyzeScannerImageRequest = z.infer<
  typeof AnalyzeScannerImageRequestSchema
>

// Result schema for scanner app AI analysis
export const AIScannerAnalysisResultSchema = z.object({
  type: z.string(),
  categoryId: z.string().optional(),
  categoryPath: z.string().optional(),
  brand: z.string(),
  model: z.string(),
  typeNumber: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  estimatedAge: z.number(),
  condition: z.enum(['good', 'fair', 'poor']),
  confidence: z.number().min(0).max(1),
})

export type AIScannerAnalysisResult = z.infer<
  typeof AIScannerAnalysisResultSchema
>

// TODO: Future enhancement - Add ComponentAnalysisModeEnum for GENERAL/TYPE_PLATE modes
// TODO: Future enhancement - Add suggestions object with categoryNames, typeNames, subtypeNames
// TODO: Future enhancement - Add warnings array for low confidence alerts
