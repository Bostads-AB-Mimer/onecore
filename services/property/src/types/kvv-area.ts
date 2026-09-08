import { property } from '@onecore/types'
import { z } from 'zod'

// Shared vocabulary (libs/types) — re-exported so local consumers keep their
// existing imports; do not re-declare it here.
export const {
  KvvAreaRefSchema,
  CostCenterRefSchema,
  KvvAreaWithCostCenterSchema,
  PropertyKvvAreaLookupSchema,
} = property
export type KvvAreaWithCostCenter = property.KvvAreaWithCostCenter
export type PropertyKvvAreaLookup = property.PropertyKvvAreaLookup

export const PutPropertyKvvAreaBodySchema = z.object({
  kvvAreaId: z.string().uuid(),
  updatedBy: z.string().max(255).optional(),
})

export type PutPropertyKvvAreaBody = z.infer<
  typeof PutPropertyKvvAreaBodySchema
>

export const PropertyKvvAreaLinkSchema = z.object({
  propertyCode: z.string(),
  kvvAreaId: z.string().uuid(),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
})

export type PropertyKvvAreaLink = z.infer<typeof PropertyKvvAreaLinkSchema>

export const KvvAreaSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string().nullable(),
  costCenterId: z.string().uuid(),
  responsibleKeycloakUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  updatedBy: z.string().nullable(),
})

export type KvvArea = z.infer<typeof KvvAreaSchema>

export const PatchKvvAreaResponsibleSchema = z.object({
  keycloakUserId: z.string().uuid(),
  updatedBy: z.string().min(1),
})

export type PatchKvvAreaResponsibleBody = z.infer<
  typeof PatchKvvAreaResponsibleSchema
>
