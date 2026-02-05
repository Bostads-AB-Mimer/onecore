import { z } from 'zod'

// ==================== AI COMPONENT ANALYSIS (Vitvaror) ====================

// MVP: Request schema with primary image and optional additional image
// Base64 encoding adds ~33% overhead: 10MB file ≈ 13.3MB base64
// Two images allow: typeplate + product photo for better accuracy
export const AnalyzeComponentImageRequestSchema = z.object({
  image: z
    .string()
    .min(1, 'Base64 image data is required')
    .max(14_000_000, 'Image too large (max 10MB)'),
  additionalImage: z
    .string()
    .max(14_000_000, 'Additional image too large (max 10MB)')
    .optional(),
})

// MVP: Core AI analysis fields focused on Swedish appliances (vitvaror)
// All fields nullable except confidence (AI might not detect everything)
export const AIComponentAnalysisSchema = z.object({
  // Basic identification fields (three-level taxonomy)
  componentCategory: z.string().nullable(), // Broad category: "Vitvara", "VVS", etc.
  componentType: z.string().nullable(), // Appliance type: "Kylskåp", "Diskmaskin"
  componentSubtype: z.string().nullable(), // Variant: "60cm integrerad", "Fristående 190L"
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),

  // Condition and age assessment
  estimatedAge: z.string().nullable(),
  condition: z.string().nullable(),

  // Technical information from labels
  specifications: z.string().nullable(),
  dimensions: z.string().nullable(),
  warrantyMonths: z.number().int().min(0).nullable(),

  // Classification codes
  ncsCode: z.string().nullable(),

  // Additional information
  additionalInformation: z.string().nullable(),

  // Confidence score (always present)
  confidence: z.number().min(0).max(1),
})

export type AnalyzeComponentImageRequest = z.infer<
  typeof AnalyzeComponentImageRequestSchema
>
export type AIComponentAnalysis = z.infer<typeof AIComponentAnalysisSchema>

// TODO: Future enhancement - Add ComponentAnalysisModeEnum for GENERAL/TYPE_PLATE modes
// TODO: Future enhancement - Add suggestions object with categoryNames, typeNames, subtypeNames
// TODO: Future enhancement - Add warnings array for low confidence alerts
