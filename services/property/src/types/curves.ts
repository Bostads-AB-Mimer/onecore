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

// Public request/response schemas live in `@onecore/types` (property module)
// as the single source of truth shared with core. Only the EcoGuard upstream
// shapes stay here.

export type EcoGuardTokenResponse = z.infer<typeof EcoGuardTokenResponseSchema>
export type EcoGuardApartmentNode = z.infer<typeof EcoGuardApartmentNodeSchema>
export type EcoGuardDataResponse = z.infer<typeof EcoGuardDataResponseSchema>
