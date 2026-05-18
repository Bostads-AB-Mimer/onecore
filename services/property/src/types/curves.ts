import { z } from 'zod'

// ---- Upstream EcoGuard schemas (raw API responses) ----

export const EcoGuardTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  email: z.string().optional(),
})

export const EcoGuardNodeTypeSchema = z.object({
  ID: z.number(),
  Code: z.number(),
  Name: z.string(),
})

export const EcoGuardApartmentNodeSchema = z.object({
  ObjectNumber: z.string(),
  ParentNodeID: z.number().nullable().optional(),
  ID: z.number(),
  Name: z.string(),
  NodeType: EcoGuardNodeTypeSchema,
})

export const EcoGuardDataValueSchema = z.object({
  Time: z.number(),
  Value: z.number(),
})

// Result entries arrive one per Utl/Func combination (e.g. one for avg, one
// for min, one for max). The service layer merges them per Time into a single
// per-timestamp point.
export const EcoGuardDataResultSchema = z.object({
  Utl: z.string(),
  Func: z.string(),
  Unit: z.string(),
  Values: z.array(EcoGuardDataValueSchema),
})

export const EcoGuardDataSubNodeSchema = z.object({
  ID: z.number(),
  Name: z.string(),
  Result: z.array(EcoGuardDataResultSchema),
})

export const EcoGuardDataResponseSchema = z.array(EcoGuardDataSubNodeSchema)

// ---- Public schemas (request + response shape) ----

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

export type EcoGuardTokenResponse = z.infer<typeof EcoGuardTokenResponseSchema>
export type EcoGuardApartmentNode = z.infer<typeof EcoGuardApartmentNodeSchema>
export type EcoGuardDataResponse = z.infer<typeof EcoGuardDataResponseSchema>
export type ApartmentTemperaturesQuery = z.infer<
  typeof ApartmentTemperaturesQuerySchema
>
export type ApartmentTemperaturesInterval = z.infer<
  typeof ApartmentTemperaturesIntervalSchema
>
export type ApartmentTemperaturesResponse = z.infer<
  typeof ApartmentTemperaturesResponseSchema
>
