import { z } from 'zod'

export const UpdateComponentInspectionStateSchema = z.object({
  condition: z.enum(['GOOD', 'FAIR', 'DAMAGED']),
  lastInspectionDate: z.string().datetime(),
})

export type UpdateComponentInspectionState = z.infer<
  typeof UpdateComponentInspectionStateSchema
>

// ---- Residence: Mälarenergi facility id ("Anläggnings ID Mälarenergi") ----
// Request body for upserting a residence's Mälarenergi facility id. Shared
// between the property service and the core proxy — source of truth, do not
// re-declare in either consumer.
export const UpdateMalarEnergiFacilityIdRequestSchema = z.object({
  malarEnergiFacilityId: z.string().trim().min(1),
})

// Response shape for the upsert — shared so neither the service nor the core
// proxy hand-declares it. Value is echoed back after a successful write.
export const UpdateMalarEnergiFacilityIdResponseSchema = z.object({
  malarEnergiFacilityId: z.string(),
})

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
