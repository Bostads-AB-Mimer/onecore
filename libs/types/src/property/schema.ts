import { z } from 'zod'

export const UpdateComponentInspectionStateSchema = z.object({
  condition: z.enum(['GOOD', 'FAIR', 'DAMAGED']),
  lastInspectionDate: z.string().datetime(),
})

export type UpdateComponentInspectionState = z.infer<
  typeof UpdateComponentInspectionStateSchema
>

// ---- Apartment temperatures (EcoGuard Curves) ----
// Public request/response shapes shared between the property service and the
// core proxy. Source of truth — do not re-declare these in either consumer.

export const ApartmentTemperaturesIntervalSchema = z.enum(['H', 'D'])

export const ApartmentTemperaturesQuerySchema = z
  .object({
    from: z.coerce.number().int().positive().optional(),
    to: z.coerce.number().int().positive().optional(),
    interval: ApartmentTemperaturesIntervalSchema.optional(),
  })
  .refine((q) => q.from === undefined || q.to === undefined || q.to > q.from, {
    message: '`to` must be greater than `from`',
    path: ['to'],
  })

export const ApartmentTemperaturePointSchema = z.object({
  time: z.number(),
  avg: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
})

export const ApartmentTemperatureSeriesSchema = z.object({
  subNodeId: z.number(),
  subNodeName: z.string(),
  points: z.array(ApartmentTemperaturePointSchema),
})

export const ApartmentTemperaturesResponseSchema = z.object({
  objectNumber: z.string(),
  nodeId: z.number(),
  from: z.number(),
  to: z.number(),
  interval: ApartmentTemperaturesIntervalSchema,
  unit: z.string(),
  series: z.array(ApartmentTemperatureSeriesSchema),
})

// ---- AI component image analysis ----
// Request/response shapes for POST /components/analyze-image, shared between
// the property service and the core proxy. Source of truth — do not
// re-declare these in either consumer.

// Base64 encoding adds ~33% overhead: a 10MB file is ≈ 13.3MB of base64,
// hence the 14_000_000 character limit.
export const AnalyzeComponentImageRequestSchema = z.object({
  image: z
    .string()
    .min(1, 'Base64 image data is required')
    .max(14_000_000, 'Image too large (max 10MB)'),
  additionalImage: z
    .string()
    .max(14_000_000, 'Additional image too large (max 10MB)')
    .optional(),
  // Component category id from the component library. The property service
  // looks up the category (selects the analysis prompt) and its component
  // types (constrains the classification). Falls back to a general prompt
  // when omitted.
  categoryId: z.string().uuid().optional(),
})

// All fields nullable except confidence (the AI might not detect everything)
export const AIComponentAnalysisSchema = z.object({
  componentCategory: z.string().nullable(),
  componentType: z.string().nullable(),
  componentSubtype: z.string().nullable(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  estimatedAge: z.string().nullable(),
  condition: z.string().nullable(),
  specifications: z.string().nullable(),
  dimensions: z.string().nullable(),
  warrantyMonths: z.number().int().min(0).nullable(),
  ncsCode: z.string().nullable(),
  additionalInformation: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})
