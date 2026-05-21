import { z } from 'zod'

export const CostCenterTreeAddressSchema = z.object({
  buildingCode: z.string(),
  buildingName: z.string().nullable(),
  address: z.string().nullable(),
})

export const CostCenterTreeAggregatesSchema = z.object({
  residenceCount: z.number().int().nonnegative(),
  parkingCount: z.number().int().nonnegative(),
  entranceCount: z.number().int().nonnegative(),
})

export const CostCenterTreePropertySchema = z.object({
  code: z.string(),
  designation: z.string().nullable(),
  tract: z.string().nullable(),
  addresses: z.array(CostCenterTreeAddressSchema),
  aggregates: CostCenterTreeAggregatesSchema,
})

export const CostCenterTreeKvvAreaSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string().nullable(),
  responsibleKeycloakUserId: z.string().nullable(),
  properties: z.array(CostCenterTreePropertySchema),
})

export const CostCenterTreeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  leadKeycloakUserId: z.string().nullable(),
  deputyKeycloakUserId: z.string().nullable(),
  kvvAreas: z.array(CostCenterTreeKvvAreaSchema),
})

export type CostCenterTree = z.infer<typeof CostCenterTreeSchema>
